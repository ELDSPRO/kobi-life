/*
 * test-briefing.js — the interactive daily-briefing engine (choices,
 * cooldowns, pity, follow-ups, save/load, diary). Complements
 * test-sm365.js (core actions) and test-modifiers.js (economy). Run with
 * `node test-briefing.js`.
 */
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const path = require("path");

function loadGame(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const script = matches[matches.length - 1][1];
  const localStorage = {
    store: {},
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
    },
    setItem(key, value) {
      this.store[key] = String(value);
    }
  };
  const context = {
    console,
    localStorage,
    setTimeout(fn) {
      if (typeof fn === "function") fn();
      return 0;
    },
    clearTimeout() {},
    Date,
    Math,
    JSON
  };
  context.globalThis = context;
  vm.createContext(context);
  const dataPath = path.join(path.dirname(htmlPath), "data.js");
  if (fs.existsSync(dataPath)) {
    vm.runInContext(fs.readFileSync(dataPath, "utf8"), context);
  }
  vm.runInContext(script, context);
  return context;
}

function run(htmlPath) {
  const failures = [];

  function check(label, fn) {
    try {
      fn();
      console.log("  ok -", label);
    } catch (err) {
      failures.push(label + ": " + err.message);
      console.log("  FAIL -", label, "-", err.message);
    }
  }

  // --- determinism: same seed -> same sequence of chosen briefing ids ---
  check("deterministic RNG: identical seed replays identical briefing ids", () => {
    function runDays(n) {
      const game = loadGame(htmlPath);
      game.startGame({});
      const ids = [game.getState().dailyBriefing && game.getState().dailyBriefing.id];
      for (let i = 0; i < n; i += 1) {
        game.endDay();
        ids.push(game.getState().dailyBriefing && game.getState().dailyBriefing.id);
      }
      return ids;
    }
    const a = runDays(25);
    const b = runDays(25);
    assert.deepStrictEqual(a, b, "two fresh games with the same default seed must pick identical events");
  });

  // --- per-event cooldown is respected ---
  check("cooldownDays: an event with a cooldown does not refire before it elapses", () => {
    const game = loadGame(htmlPath);
    game.startGame({});
    // Track every day each event fires across a long run, then assert no two
    // firings of a cooldownDays event are closer together than its cooldown.
    const seenDay = {};
    for (let i = 0; i < 120; i += 1) {
      game.endDay();
      const brief = game.getState().dailyBriefing;
      if (!brief) continue;
      seenDay[brief.id] = seenDay[brief.id] || [];
      seenDay[brief.id].push(brief.day);
    }
    const cooldownEventId = "boss_pleased_shift"; // cooldownDays: 18
    const fireDays = seenDay[cooldownEventId] || [];
    for (let i = 1; i < fireDays.length; i += 1) {
      assert.ok(fireDays[i] - fireDays[i - 1] >= 18, cooldownEventId + " refired after only " + (fireDays[i] - fireDays[i - 1]) + " days (cooldownDays is 18)");
    }
  });

  // --- pity: no 3 consecutive bad-tone briefings ---
  check("pity: never three consecutive bad-tone briefings", () => {
    const game = loadGame(htmlPath);
    game.startGame({});
    let streak = 0;
    let maxStreak = 0;
    for (let i = 0; i < 150; i += 1) {
      game.endDay();
      const brief = game.getState().dailyBriefing;
      const tone = brief ? brief.tone : "neutral";
      streak = tone === "bad" ? streak + 1 : 0;
      maxStreak = Math.max(maxStreak, streak);
    }
    assert.ok(maxStreak <= 2, "saw a streak of " + maxStreak + " consecutive bad-tone briefings, pity should cap this at 2");
  });

  // --- choice cost/effect math ---
  check("choice cost/effects: cash and stat deltas apply exactly once", () => {
    const game = loadGame(htmlPath);
    game.startGame({});
    // Force a known state: drive days until the deterministic sequence
    // produces a choice-bearing event, then resolve a costed choice.
    let found = null;
    for (let i = 0; i < 60 && !found; i += 1) {
      game.endDay();
      const brief = game.getState().dailyBriefing;
      if (brief && brief.choices.some((c) => c.cost && c.cost.cash)) {
        found = brief;
      }
    }
    assert.ok(found, "expected at least one costed choice within 60 days");
    const choice = found.choices.find((c) => c.cost && c.cost.cash);
    const cashBefore = game.getState().cash;
    game.resolveBriefChoice(choice.id);
    const cashAfter = game.getState().cash;
    assert.strictEqual(cashAfter, cashBefore - choice.cost.cash, "cash should drop by exactly the choice's cash cost");
    assert.strictEqual(game.getState().dailyBriefing.resolved, true, "brief should be marked resolved after a choice");
  });

  // --- insufficient cash blocks a choice without crashing or charging ---
  check("insufficient cash: an unaffordable choice is refused, no partial charge", () => {
    const game = loadGame(htmlPath);
    game.startGame({});
    game.getState().cash = 0;
    let found = null;
    for (let i = 0; i < 60 && !found; i += 1) {
      game.endDay();
      const brief = game.getState().dailyBriefing;
      if (brief && !brief.resolved && brief.choices.some((c) => c.cost && c.cost.cash)) {
        found = brief;
      }
      if (found) break;
    }
    assert.ok(found, "expected a costed-choice event within 60 days");
    const choice = found.choices.find((c) => c.cost && c.cost.cash);
    const cashBefore = game.getState().cash;
    game.resolveBriefChoice(choice.id);
    assert.strictEqual(game.getState().cash, cashBefore, "cash must not change when the choice was unaffordable");
    assert.strictEqual(game.getState().dailyBriefing.resolved, false, "an unaffordable choice must not resolve the brief");
  });

  // --- follow-up chaining: a scheduled follow-up actually fires later ---
  check("follow-up: a choice's followUpEventId fires on schedule", () => {
    const game = loadGame(htmlPath);
    game.startGame({});
    game.getState().jobId = "popcorn"; // boss_pleased_shift requires a job
    let boss = null;
    for (let i = 0; i < 40 && !boss; i += 1) {
      game.endDay();
      const brief = game.getState().dailyBriefing;
      if (brief && brief.id === "boss_pleased_shift") boss = brief;
    }
    assert.ok(boss, "boss_pleased_shift should fire within 40 days");
    game.resolveBriefChoice("ask_more_hours");
    const scheduledDay = game.getState().pendingFollowUps.find((f) => f.id === "extra_hours_offer");
    assert.ok(scheduledDay, "ask_more_hours should schedule extra_hours_offer");
    let followUpSeen = false;
    for (let i = 0; i < 10 && !followUpSeen; i += 1) {
      game.endDay();
      if (game.getState().dailyBriefing && game.getState().dailyBriefing.id === "extra_hours_offer") {
        followUpSeen = true;
      }
    }
    assert.ok(followUpSeen, "extra_hours_offer should fire within its scheduled window");
  });

  // --- save/load: a resolved or dismissed brief never re-shows ---
  check("save/load: a dismissed brief stays dismissed after reload", () => {
    const game = loadGame(htmlPath);
    game.startGame({});
    game.endDay();
    game.dismissMorningBrief();
    assert.strictEqual(game.getState().dailyBriefing.dismissed, true);
    game.saveGame();
    const dayBefore = game.getState().day;
    const idBefore = game.getState().dailyBriefing.id;
    game.loadGame();
    assert.strictEqual(game.getState().day, dayBefore, "day must be unchanged after load");
    assert.strictEqual(game.getState().dailyBriefing.id, idBefore, "the same briefing must still be there after load");
    assert.strictEqual(game.getState().dailyBriefing.dismissed, true, "dismissed must survive save/load, not re-show");
  });

  // --- diary logs a resolved choice with day/title/source/result ---
  check("story diary: a resolved choice with a result copy logs one entry", () => {
    const game = loadGame(htmlPath);
    game.startGame({});
    let withResult = null;
    for (let i = 0; i < 40 && !withResult; i += 1) {
      game.endDay();
      const brief = game.getState().dailyBriefing;
      if (brief && brief.choices.some((c) => c.id !== "ack")) withResult = brief;
    }
    assert.ok(withResult, "expected a real (non-ack) choice within 40 days");
    const before = game.getState().storyDiary.length;
    game.resolveBriefChoice(withResult.choices[0].id);
    const after = game.getState().storyDiary;
    assert.strictEqual(after.length, before + 1, "exactly one diary entry should be added on resolve");
    assert.strictEqual(after[0].day, game.getState().day);
    assert.ok(after[0].title, "diary entry needs a title");
    assert.ok(after[0].source, "diary entry needs a source");
  });

  // --- day-transition ordering: dayDelta reflects night settlement, briefing follows it ---
  check("day flow: dayDelta is computed before the new briefing fires", () => {
    const game = loadGame(htmlPath);
    game.startGame({});
    game.endDay();
    const s = game.getState();
    assert.ok(s.dayDelta, "dayDelta should be populated after endDay");
    assert.ok(s.dailyBriefing, "a briefing should exist after endDay");
    assert.strictEqual(s.dailyBriefing.day, s.day, "briefing day should match the new day, not the old one");
  });

  return failures;
}

const target = path.join(__dirname, "studio-mogul-365.html");
const failures = run(target);
if (failures.length) {
  console.error("\ntest-briefing: FAILED (" + failures.length + ")");
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}
console.log("test-briefing: ok");
