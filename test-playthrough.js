// Headless playthrough harness for studio-mogul-dope-wars.html ("קובי / קריירה").
//
// Runs the full career ladder (age 21 -> retirement/loss) under three archetypal
// strategies - greedy-money, fame-first, random - across several seeds, and prints
// a per-stage pacing table: entry/exit age, cash+bank+debt at entry, whether the
// stage was cleared via its required milestones or a fallback path, and bankruptcy
// strikes accrued during the stage. Flags any stage that clears in under half its
// age-range span or over 1.5x it - that's a pacing bug, not a success (see the
// shared project rules).
//
// Also runs a dedicated batch (random strategy, hard difficulty) to check the
// closing-gate requirement that hard produces at least one bankruptcy in >=40% of
// random-strategy runs.

const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

function makeMemoryStorage() {
  const store = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadGame(htmlPath, randomFn) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const match = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  assert.ok(match, "the game has a playable inline script");
  const context = { console, Math: Object.create(Math), JSON, Intl, localStorage: makeMemoryStorage() };
  context.Math.random = randomFn;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(match[1], context);
  return context.kobiFilmTrader;
}

// --- strategy policy ---------------------------------------------------------

const GREEDY_CHECKPOINT_PICK = {
  specialize: "spec-producing", thesis: "thesis-safe", cert: "cert-done",
  genre: "genre-comedy", script: "script-lean", cast: "cast-newface",
  shoot: "on-budget", edit: "edit-rough", distribution: "streaming-track",
  theme: "career-doc", release: "free-release"
};
const FAME_CHECKPOINT_PICK = {
  specialize: "spec-directing", thesis: "thesis-ambitious", cert: "cert-done",
  genre: "genre-drama", script: "script-ambitious", cast: "cast-star",
  shoot: "extra-shoot-day", edit: "edit-polish", distribution: "festival-track",
  theme: "personal-story", release: "solo-screening"
};
// survive first: never let the "quiet" default (give-up / ignore) win a debt crisis
const FORCED_SURVIVAL_CHOICE = {
  "החוב יצא משליטה": "emergency-loan",
  "אזהרה מההוצאה לפועל": "collector-pay"
};

function gigIsLegal(state, gig) {
  if (gig.rotates && !(state.activeGigs || []).includes(gig.id)) return false;
  for (const [id, qty] of Object.entries(gig.needs || {})) {
    if ((state.bag[id] || 0) < qty) return false;
  }
  return true;
}

function chooseGig(legalGigs, strategyName, rng) {
  if (strategyName === "random") return legalGigs[Math.floor(rng() * legalGigs.length)].id;
  if (strategyName === "fame") {
    return [...legalGigs].sort((a, b) => (b.fame || 0) - (a.fame || 0) || (b.cash || 0) - (a.cash || 0))[0].id;
  }
  return [...legalGigs].sort((a, b) => (b.cash || 0) - (a.cash || 0))[0].id; // greedy
}

function chooseEntryCommitment(stage, strategyName, rng) {
  const ids = (stage.commitments || []).map((c) => c.id);
  if (strategyName === "random") return ids[Math.floor(rng() * ids.length)];
  if (stage.id === "student") {
    if (strategyName === "fame") return ids.includes("filmSchool") ? "filmSchool" : ids[0];
    return ids.includes("selfTaught") ? "selfTaught" : ids[0]; // greedy: fastest, no debt
  }
  if (ids.includes("indieFilm")) return "indieFilm";
  if (ids.includes("legacyFilm")) return "legacyFilm";
  return ids[0];
}

function chooseEventChoiceIndex(state, strategyName, rng) {
  const choices = state.event.choices;
  // random never voluntarily quits via its own exploration - that's not a bankruptcy, it's a quit
  const nonQuit = choices.map((c, i) => i).filter((i) => !/give-up/.test(choices[i].kind || ""));
  const pool = nonQuit.length ? nonQuit : choices.map((c, i) => i);
  if (strategyName === "random") return pool[Math.floor(rng() * pool.length)];

  const forcedKind = FORCED_SURVIVAL_CHOICE[state.event.title];
  if (forcedKind) {
    const idx = choices.findIndex((c) => c.kind === forcedKind);
    if (idx !== -1) return idx;
  }
  if (state.event.title === "הוזמנת לפסטיבל") return strategyName === "fame" ? 0 : choices.length - 1;

  if (state.activeCheckpoint) {
    const pref = strategyName === "fame" ? FAME_CHECKPOINT_PICK : GREEDY_CHECKPOINT_PICK;
    const wanted = pref[state.activeCheckpoint.checkpointId];
    if (wanted) {
      const idx = choices.findIndex((c) => c.kind === wanted);
      if (idx !== -1) return idx;
    }
    return 0;
  }
  const quietIdx = choices.findIndex((c) => c.quiet);
  return quietIdx !== -1 ? quietIdx : 0;
}

function payAmountEstimate(state) { return Math.max(500, Math.round(state.debt * 0.1)); }

// --- one full playthrough ------------------------------------------------------

const MAX_TURNS = 400;

function runPlaythrough(htmlPath, strategyName, seed, difficultyId) {
  const rng = mulberry32(seed);
  const game = loadGame(htmlPath, rng);
  const stageLog = [];
  let currentStageId = null;
  let turns = 0;

  function syncStage() {
    const s = game.getState();
    if (s.stageId !== currentStageId) {
      if (stageLog.length) stageLog[stageLog.length - 1].exitAge = s.age;
      currentStageId = s.stageId;
      stageLog.push({
        stageId: s.stageId, entryAge: s.age, exitAge: null,
        entryCash: s.cash, entryBank: s.bank, entryDebt: s.debt,
        entryStrikes: s.bankruptcyStrikes, exitStrikes: null,
        viaFallback: false
      });
    }
  }

  syncStage();
  while (!game.getState().ended && turns < MAX_TURNS) {
    turns++;
    const s = game.getState();

    if (s.pendingAction) { game.confirmGig(); syncStage(); continue; }
    if (s.briefPending) { game.closeBrief(); syncStage(); continue; }
    if (s.stageIntroPending) {
      const stage = game.STAGES.find((x) => x.id === s.stageId);
      if (s.difficulty == null && stage && stage.order === 0) game.setDifficulty(difficultyId || "normal");
      game.closeStageIntro();
      syncStage();
      continue;
    }
    if (s.event) {
      if (s.event.title === "השלב לא הושלם כמתוכנן" && stageLog.length) stageLog[stageLog.length - 1].viaFallback = true;
      const idx = chooseEventChoiceIndex(s, strategyName, rng);
      game.resolveEvent(idx);
      syncStage();
      continue;
    }

    const stage = game.STAGES.find((x) => x.id === s.stageId);
    if (!s.commitment) {
      const commitIds = (stage.commitments || []).map((c) => c.id);
      const hasEntryPath = s.pathTags.some((t) => commitIds.includes(t));
      if (!hasEntryPath && commitIds.length) {
        game.startCommitment(chooseEntryCommitment(stage, strategyName, rng));
        syncStage();
        continue;
      }
    }

    if (strategyName === "greedy" && s.debt > 0 && s.cash > payAmountEstimate(s) * 3) {
      game.bank("pay");
      syncStage();
      continue;
    }

    const legalGigs = (stage.gigs || []).filter((g) => gigIsLegal(s, g));
    if (!legalGigs.length) break; // shouldn't happen - every stage has an ungated gig
    game.doGig(chooseGig(legalGigs, strategyName, rng));
    syncStage();
  }

  const finalState = game.getState();
  if (stageLog.length) stageLog[stageLog.length - 1].exitAge = finalState.age;
  stageLog.forEach((row) => { if (row.exitStrikes == null) row.exitStrikes = finalState.bankruptcyStrikes; });

  return {
    seed, strategy: strategyName, difficulty: difficultyId || "normal",
    finished: finalState.ended, win: finalState.win, age: finalState.age,
    turns, hitTurnCap: turns >= MAX_TURNS,
    bankrupted: finalState.ended && !finalState.win,
    stageLog
  };
}

// --- reporting -------------------------------------------------------------

function fmtMoney(n) { return "₪" + Math.round(n).toLocaleString("en-US"); }

function printStagePacingTable(htmlPath, results) {
  const gameForStages = loadGame(htmlPath, () => 0.5);
  const stageOrder = gameForStages.STAGES.map((s) => ({ id: s.id, name: s.name, span: s.ageRange[1] - s.ageRange[0] }));

  console.log("\n=== Per-stage pacing (averaged across all runs that reached each stage) ===");
  console.log("stage".padEnd(14), "runs".padEnd(5), "avg span".padEnd(9), "expected".padEnd(9), "avg entry cash+bank-debt".padEnd(26), "fallback%".padEnd(10), "avg strikes gained", "flag");
  stageOrder.forEach((stage) => {
    const rows = [];
    results.forEach((r) => r.stageLog.forEach((row) => { if (row.stageId === stage.id && row.exitAge != null) rows.push(row); }));
    if (!rows.length) { console.log(stage.name.padEnd(14), "0 runs reached this stage"); return; }
    const avg = (fn) => rows.reduce((sum, row) => sum + fn(row), 0) / rows.length;
    const avgSpan = avg((row) => row.exitAge - row.entryAge);
    const avgNet = avg((row) => row.entryCash + row.entryBank - row.entryDebt);
    const fallbackPct = Math.round(100 * rows.filter((row) => row.viaFallback).length / rows.length);
    const avgStrikes = avg((row) => row.exitStrikes - row.entryStrikes);
    const flag = avgSpan < stage.span * 0.5 ? "TOO FAST" : avgSpan > stage.span * 1.5 ? "TOO SLOW" : "ok";
    console.log(
      stage.name.padEnd(14), String(rows.length).padEnd(5),
      avgSpan.toFixed(1).padEnd(9), String(stage.span).padEnd(9),
      fmtMoney(avgNet).padEnd(26), (fallbackPct + "%").padEnd(10),
      avgStrikes.toFixed(2).padEnd(19), flag
    );
  });
  return stageOrder;
}

function run(htmlPath) {
  const path = htmlPath || "studio-mogul-dope-wars.html";
  const seeds = [1001, 2002, 3003, 4004, 5005];
  const strategies = ["greedy", "fame", "random"];

  console.log("Running", seeds.length, "seeds x", strategies.length, "strategies at normal difficulty...");
  const results = [];
  strategies.forEach((strategy) => {
    seeds.forEach((seed) => {
      const r = runPlaythrough(path, strategy, seed, "normal");
      results.push(r);
      if (!r.finished) console.log(`  WARNING: ${strategy}/seed ${seed} did not finish within ${MAX_TURNS} turns (age ${r.age.toFixed(1)})`);
    });
  });

  console.log("\n=== Run summary ===");
  console.log("strategy".padEnd(9), "seed".padEnd(7), "finished".padEnd(9), "win".padEnd(6), "final age".padEnd(10), "turns");
  results.forEach((r) => {
    console.log(r.strategy.padEnd(9), String(r.seed).padEnd(7), String(r.finished).padEnd(9), String(r.win).padEnd(6), r.age.toFixed(1).padEnd(10), r.turns);
  });

  const stageOrder = printStagePacingTable(path, results);
  const legacyRows = [];
  results.forEach((r) => r.stageLog.forEach((row) => { if (row.stageId === "legacy" && row.exitAge != null) legacyRows.push(row.exitAge - row.entryAge); }));
  const legacyAvgYears = legacyRows.length ? legacyRows.reduce((a, b) => a + b, 0) / legacyRows.length : 0;
  console.log(`\nLegacy stage average duration across ${legacyRows.length} runs that reached it: ${legacyAvgYears.toFixed(2)} years (gate: >= 6)`);
  console.log(legacyAvgYears >= 6 ? "PASS: legacy stage lasts at least 6 years on average." : "FAIL: legacy stage is still clearing too fast on average.");

  // --- closing-gate: hard difficulty should bankrupt >=40% of random-strategy runs ---
  console.log("\nRunning", seeds.length, "random-strategy seeds at hard difficulty (bankruptcy-rate gate)...");
  const hardResults = seeds.map((seed) => runPlaythrough(path, "random", seed, "hard"));
  hardResults.forEach((r) => {
    console.log(`  seed ${r.seed}: finished=${r.finished} win=${r.win} bankrupted=${r.bankrupted} finalAge=${r.age.toFixed(1)} turns=${r.turns}`);
  });
  const bankruptCount = hardResults.filter((r) => r.bankrupted).length;
  const bankruptRate = bankruptCount / hardResults.length;
  console.log(`\nHard-difficulty bankruptcy rate (random strategy): ${bankruptCount}/${hardResults.length} = ${(bankruptRate * 100).toFixed(0)}% (gate: >= 40%)`);
  console.log(bankruptRate >= 0.4 ? "PASS: hard difficulty produces real bankruptcy risk." : "FAIL: hard difficulty is not risky enough - consider raising DIFFICULTY.hard's debtMult/eventChanceMult.");

  const anyTurnCapHit = results.concat(hardResults).some((r) => r.hitTurnCap);
  if (anyTurnCapHit) console.log("\nWARNING: at least one run hit the turn cap without finishing - investigate before trusting the pacing numbers above.");

  return { results, hardResults, legacyAvgYears, bankruptRate, stageOrder };
}

if (require.main === module) {
  const summary = run(process.argv[2] || "studio-mogul-dope-wars.html");
  const ok = summary.legacyAvgYears >= 6 && summary.bankruptRate >= 0.4 && !summary.results.concat(summary.hardResults).some((r) => r.hitTurnCap);
  console.log(ok ? "\ntest-playthrough: ok" : "\ntest-playthrough: gates not fully met (see FAIL/WARNING lines above)");
  process.exitCode = ok ? 0 : 1;
}

module.exports = { run, runPlaythrough };
