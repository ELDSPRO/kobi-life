/*
 * simulate-briefing.js — scratch balance-check script (not part of the
 * permanent suite). Runs several seeds x strategies for 30 simulated days,
 * picking a real choice whenever the morning brief offers one, and reports
 * end-state + any crash/soft-lock signal. Run with `node simulate-briefing.js`.
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

function loadGame(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
  const localStorage = {
    store: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; },
    setItem(k, v) { this.store[k] = String(v); }
  };
  const context = {
    console, localStorage,
    setTimeout(fn) { if (typeof fn === "function") fn(); return 0; },
    clearTimeout() {}, Date, Math, JSON
  };
  context.globalThis = context;
  vm.createContext(context);
  const dataPath = path.join(path.dirname(htmlPath), "data.js");
  vm.runInContext(fs.readFileSync(dataPath, "utf8"), context);
  vm.runInContext(script, context);
  return context;
}

function pickChoice(brief, strategy) {
  const choices = brief.choices.filter((c) => c.afford);
  if (!choices.length) return brief.choices[0]; // will be refused (unaffordable), that's fine — mirrors a real broke player
  if (strategy === "stable") {
    return choices.slice().sort((a, b) => (a.cost && a.cost.cash || 0) - (b.cost && b.cost.cash || 0))[0];
  }
  if (strategy === "risky") {
    return choices.slice().sort((a, b) => (b.cost && b.cost.cash || 0) - (a.cost && a.cost.cash || 0))[0];
  }
  // social/creative: prefer whichever choice's id/label suggests connection or rest
  const social = choices.find((c) => /party|premiere|couch|cafe|rest|ask_more|attend|let_him/.test(c.id));
  return social || choices[0];
}

const strategies = ["stable", "risky", "social"];
const seeds = [1337, 4242, 90210];
const DAYS = 30;
const target = path.join(__dirname, "studio-mogul-365.html");
const report = [];

strategies.forEach((strategy) => {
  seeds.forEach((seed) => {
    let crashed = null;
    let endedEarly = null;
    const game = loadGame(target);
    game.startGame({});
    game.getState().seed = seed;
    game.getState().briefSeed = seed * 7 + 1;
    // give every run a job partway in so job-gated events can appear
    let choicesMade = 0;
    let costedPicked = 0;
    try {
      for (let day = 0; day < DAYS; day += 1) {
        if (day === 3 && !game.getState().jobId) {
          game.getState().jobId = "popcorn"; // unblock job-gated briefs for the sim
        }
        game.endDay();
        const brief = game.getState().dailyBriefing;
        if (brief && !brief.resolved && !brief.dismissed) {
          const choice = pickChoice(brief, strategy);
          game.resolveBriefChoice(choice.id);
          choicesMade += 1;
          if (choice.cost && choice.cost.cash) costedPicked += 1;
        }
        if (game.getState().winState && !endedEarly) {
          endedEarly = { day: game.getState().day, endingId: game.getState().winState.endingId };
        }
      }
    } catch (err) {
      crashed = err.stack;
    }
    const s = game.getState();
    report.push({
      strategy, seed, crashed, endedEarly,
      finalDay: s.day, cash: s.cash, debt: s.debt, reputation: s.reputation,
      education: s.education, happiness: Math.round((s.soul + s.creativity + s.love) / 3),
      diaryEntries: (s.storyDiary || []).length,
      choicesMade, costedPicked,
      badStreakEverExceeded: s.briefBadStreak > 2
    });
  });
});

console.log(JSON.stringify(report, null, 2));
const crashes = report.filter((r) => r.crashed);
const softLocks = report.filter((r) => !r.endedEarly && r.finalDay < DAYS);
console.log("\n--- summary ---");
console.log("runs:", report.length, "crashes:", crashes.length, "incomplete (soft-lock signal):", softLocks.length);
if (crashes.length) {
  crashes.forEach((c) => console.log(c.strategy, c.seed, c.crashed));
}
