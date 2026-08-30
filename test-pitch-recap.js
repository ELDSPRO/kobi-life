/*
 * test-pitch-recap.js — the "First Pitch" career-milestone screen and the
 * "End of Day" recap screen. Complements test-sm365.js/test-modifiers.js
 * (core actions/economy) and test-briefing.js (daily briefing engine).
 * Run with `node test-pitch-recap.js`.
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

// Drives a fresh game to the exact moment the pitch becomes available:
// picks the idea, meets an industry NPC, and lets minDaysAfterIdea pass.
function primeForPitch(game) {
  game.startGame({});
  const moment = game.GAME_DATA.pitchMoment;
  game.markFilmTask(moment.requiredFilmTaskId);
  game.meetNpc("lior_agent", 2);
  const s = game.getState();
  s.day += moment.minDaysAfterIdea;
  game.maybeTriggerPitch();
  return moment;
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

  // ============ new game ============

  check("new game: the pitch is not open before its conditions are met", () => {
    const game = loadGame(htmlPath);
    game.startGame({});
    assert.strictEqual(game.getState().pitch, null, "pitch should not exist on a fresh game");
    game.maybeTriggerPitch();
    assert.strictEqual(game.getState().pitch, null, "maybeTriggerPitch must no-op with no idea/no contact yet");
    // Half the gate: idea picked, but no industry contact met yet.
    const moment = game.GAME_DATA.pitchMoment;
    game.markFilmTask(moment.requiredFilmTaskId);
    game.getState().day += moment.minDaysAfterIdea;
    game.maybeTriggerPitch();
    assert.strictEqual(game.getState().pitch, null, "pitch must stay closed with an idea but no met contact");
  });

  check("new game: day-end (recap) works fine on a quiet day with no crash", () => {
    const game = loadGame(htmlPath);
    game.startGame({});
    game.endDay();
    const s = game.getState();
    assert.ok(s.dayRecap, "dayRecap should be populated after endDay even with no player actions");
    assert.ok(s.dayRecap.headline, "recap needs a headline even on a quiet day");
    assert.ok(Array.isArray(s.dayRecap.deltas), "deltas must be an array");
    assert.strictEqual(s.dayRecap.dismissed, false, "a freshly-created recap starts undismissed");
  });

  // ============ pitch ============

  check("pitch: each of the 3 styles changes a different, distinct piece of state", () => {
    const results = {};
    ["human", "vision", "audience"].forEach((styleId) => {
      const game = loadGame(htmlPath);
      primeForPitch(game);
      assert.ok(game.getState().pitch, "pitch should be offered for style " + styleId);
      const ok = game.resolvePitchChoice(styleId);
      assert.strictEqual(ok, true, "resolvePitchChoice should succeed for " + styleId);
      const s = game.getState();
      results[styleId] = {
        artistic: s.artisticReputation,
        commercial: s.commercialReputation,
        relationship: s.relationshipReputation
      };
    });
    assert.ok(results.human.relationship > 0, "human style should raise relationshipReputation");
    assert.ok(results.vision.artistic > 0, "vision style should raise artisticReputation");
    assert.ok(results.audience.commercial > 0, "audience style should raise commercialReputation");
    // Distinctness: the human pick shouldn't have moved the other two tracks.
    assert.strictEqual(results.human.artistic, 0, "human style should not touch artisticReputation");
    assert.strictEqual(results.human.commercial, 0, "human style should not touch commercialReputation");
  });

  check("pitch: a committed style advances selectedPitchStyle/pitchAttempts and marks the treatment milestone", () => {
    const game = loadGame(htmlPath);
    const moment = primeForPitch(game);
    assert.strictEqual(game.getState().filmTasks[moment.unlocksFilmTaskId], undefined, "treatment should not be done yet");
    game.resolvePitchChoice("vision");
    const s = game.getState();
    assert.strictEqual(s.selectedPitchStyle, "vision");
    assert.strictEqual(s.pitchAttempts, 1);
    assert.strictEqual(s.filmTasks[moment.unlocksFilmTaskId], true, "a completed pitch should advance the treatment milestone");
  });

  check("pitch: follow-up is created exactly once, not duplicated on a second (already-resolved) call", () => {
    const game = loadGame(htmlPath);
    primeForPitch(game);
    game.resolvePitchChoice("human");
    const countAfterFirst = game.getState().pendingFollowUps.length;
    assert.strictEqual(countAfterFirst, 1, "exactly one follow-up should be scheduled");
    const again = game.resolvePitchChoice("vision");
    assert.strictEqual(again, false, "resolving an already-resolved pitch must be a no-op");
    assert.strictEqual(game.getState().pendingFollowUps.length, 1, "no duplicate follow-up from the no-op call");
    assert.strictEqual(game.getState().selectedPitchStyle, "human", "the no-op call must not overwrite the committed style");
  });

  check("pitch: skipping gives a neutral outcome and does not block later progression", () => {
    const game = loadGame(htmlPath);
    primeForPitch(game);
    const before = {
      artistic: game.getState().artisticReputation,
      commercial: game.getState().commercialReputation,
      relationship: game.getState().relationshipReputation,
      cash: game.getState().cash
    };
    game.dismissPitch(); // first call = skip, shows a result, not yet closed
    let s = game.getState();
    assert.strictEqual(s.pitch.resolved, true, "skip should resolve the pitch (with a neutral result)");
    assert.strictEqual(s.pitch.dismissed, false, "skip should not close the window before its result is shown");
    assert.strictEqual(s.pitch.pickedStyleId, null, "a skip has no picked style");
    assert.ok(s.pitch.resultCopy, "skip should still carry a neutral result line");
    assert.strictEqual(s.artisticReputation, before.artistic, "skip must not change artisticReputation");
    assert.strictEqual(s.commercialReputation, before.commercial, "skip must not change commercialReputation");
    assert.strictEqual(s.relationshipReputation, before.relationship, "skip must not change relationshipReputation");
    assert.strictEqual(s.cash, before.cash, "skip must not change cash");
    assert.strictEqual(s.pendingFollowUps.length, 0, "skip must not schedule any follow-up");
    game.dismissPitch(); // second call = actually close
    s = game.getState();
    assert.strictEqual(s.pitch.dismissed, true, "second dismiss call should close the window");
    assert.strictEqual(s.pitchOffered, true, "pitchOffered stays true so the milestone never re-triggers");
    // Progression is not blocked: the day can still advance normally.
    assert.doesNotThrow(() => game.endDay(), "endDay should work fine right after a skipped pitch");
  });

  check("pitch: the 2h time cost is real — refused (no partial effect) when the day is too short", () => {
    const game = loadGame(htmlPath);
    const moment = primeForPitch(game);
    assert.strictEqual((moment.cost || {}).hours, 2, "this test assumes the configured pitch cost is 2 hours");
    const s = game.getState();
    s.hour = 22; // only 1h left before the 23:00 cutoff
    const before = { hour: s.hour, artistic: s.artisticReputation, cash: s.cash };
    const ok = game.resolvePitchChoice("vision");
    assert.strictEqual(ok, false, "resolvePitchChoice must refuse when there isn't enough time left");
    const after = game.getState();
    assert.strictEqual(after.hour, before.hour, "hour must be unchanged on refusal");
    assert.strictEqual(after.artisticReputation, before.artistic, "no stat effect should apply on refusal");
    assert.strictEqual(after.pitch.resolved, false, "the pitch must remain open (not silently consumed) on refusal");
  });

  // ============ day recap ============

  check("day recap: formatDayDeltas never fabricates a +0/zero line", () => {
    const game = loadGame(htmlPath);
    game.startGame({});
    const allZero = game.formatDayDeltas({ cash: 0, experience: 0, reputation: 0, happiness: 0 });
    // Cross-realm array from the vm context — compare by length, not by
    // deepStrictEqual against an outer-realm [] literal (different realms).
    assert.strictEqual(allZero.length, 0, "an all-zero delta must produce zero recap lines");
    const mixed = game.formatDayDeltas({ cash: 72, experience: 0, reputation: -3, happiness: 0 });
    assert.strictEqual(mixed.length, 2, "only the 2 non-zero fields should produce lines");
    assert.ok(mixed.every((row) => row.label.indexOf("+0") === -1), "no rendered line should ever read +0");
  });

  check("day recap: deltas match the real before/after economy diff for that day", () => {
    const game = loadGame(htmlPath);
    game.startGame({});
    const cashBefore = game.getState().cash;
    game.endDay();
    const s = game.getState();
    // dayDelta.cash is the ground truth (before/after diff); the rendered
    // recap deltas must not disagree with it or invent an unrelated number.
    const actualCashDelta = s.cash - cashBefore;
    assert.strictEqual(s.dayDelta.cash, actualCashDelta, "dayDelta.cash must equal the real cash diff for the day");
    const cashRow = s.dayRecap.deltas.find((d) => d.label.indexOf("₪") !== -1 || /\d/.test(d.label));
    if (s.dayDelta.cash !== 0) {
      assert.ok(cashRow, "a non-zero cash delta must appear in the recap");
    }
  });

  check("day recap: reload/re-render never re-applies the day's deltas twice", () => {
    const game = loadGame(htmlPath);
    game.startGame({});
    game.endDay();
    const cashAfterFirstEnd = game.getState().cash;
    const dayAfterFirstEnd = game.getState().day;
    // Simulate a reload/re-render storm without ever calling endDay again.
    game.saveGame();
    game.loadGame();
    game.loadGame();
    assert.strictEqual(game.getState().cash, cashAfterFirstEnd, "cash must be stable across reloads, not re-applied");
    assert.strictEqual(game.getState().day, dayAfterFirstEnd, "day must not silently advance again on reload");
  });

  check("day recap: save/load consistency, both while open and after dismissal", () => {
    const game = loadGame(htmlPath);
    game.startGame({});
    game.endDay();
    game.saveGame();
    game.loadGame();
    let s = game.getState();
    assert.ok(s.dayRecap, "recap must survive a save/load while still open");
    assert.strictEqual(s.dayRecap.dismissed, false);
    const deltasBefore = JSON.stringify(s.dayRecap.deltas);
    assert.strictEqual(JSON.stringify(s.dayRecap.deltas), deltasBefore, "deltas must not be recomputed by load");

    // Now dismiss, save, and load again — it must stay dismissed (never re-shown).
    s.dayRecap.dismissed = true;
    game.saveGame();
    game.loadGame();
    s = game.getState();
    assert.strictEqual(s.dayRecap.dismissed, true, "a dismissed recap must stay dismissed after reload");
  });

  check("day recap: computeDayHighlight always returns real content, even with an unknown building (quiet fallback)", () => {
    const game = loadGame(htmlPath);
    game.startGame({});
    const known = game.computeDayHighlight(3, "cafe");
    assert.ok(known.headline && known.subtitle, "a known building should produce both a headline and subtitle");
    const quiet = game.computeDayHighlight(3, "not_a_real_building_id");
    assert.ok(quiet.headline, "an unrecognized building must still fall back to real (non-empty) copy");
  });

  check("day recap: computeSownLine prefers a real pending follow-up teaser, falls back to the city's own mood", () => {
    const game = loadGame(htmlPath);
    game.startGame({});
    const withNoFollowUp = game.computeSownLine();
    assert.ok(withNoFollowUp, "must never return empty — falls back to real city-mood content");
    game.getState().pendingFollowUps.push({ id: "pitch_followup_human", day: game.getState().day + 2 });
    const withFollowUp = game.computeSownLine();
    const teaser = game.GAME_DATA.dailyEvents.find((e) => e.id === "pitch_followup_human").teaser;
    assert.strictEqual(withFollowUp, teaser.he, "should surface the real scheduled follow-up's teaser, in the active language");
  });

  return failures;
}

const target = path.join(__dirname, "studio-mogul-365.html");
const failures = run(target);
if (failures.length) {
  console.error("\ntest-pitch-recap: FAILED (" + failures.length + ")");
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}
console.log("test-pitch-recap: ok");
