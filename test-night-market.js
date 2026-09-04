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

function loadGame(htmlPath, randomFn, storage) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const match = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  assert.ok(match, "the game has a playable inline script");
  const context = { console, Math: Object.create(Math), JSON, Intl, localStorage: storage || makeMemoryStorage() };
  context.Math.random = randomFn || (() => 0.5);
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(match[1], context);
  return context.kobiFilmTrader;
}

function assertAllKind(state, goods, expectedKind) {
  goods.forEach((g) => assert.strictEqual(state.priceKinds[g.id], expectedKind, g.id + " should be " + expectedKind));
}

function clearEvent(game) {
  const state = game.getState();
  if (state.event) game.resolveEvent(state.event.choices.length - 1);
}

// multi-year commitment jumps (checkpoints, filmSchool, indieFilm/legacyFilm) can cross the debt-collector's
// 3-year-neglect threshold, or simply roll a plain random incident (a fairly large pool now), before the
// real next checkpoint opens. Call this right before asserting on state.event after any such jump. Drains
// anything that isn't the expected title via its last (quiet/no-op) choice - for the debt-collector notice
// specifically, that's "ignore" rather than "pay", so draining never perturbs the cash/debt trajectory the
// surrounding test is actually asserting on.
function drainIncidental(game, expectedTitle) {
  let state = game.getState();
  while (state.event && state.event.title !== expectedTitle) {
    game.resolveEvent(state.event.choices.length - 1);
    state = game.getState();
  }
}

function run(htmlPath) {
  const path = htmlPath || "studio-mogul-dope-wars.html";
  const game = loadGame(path);

  // --- fresh state shape ---
  let state = game.getState();
  assert.strictEqual(state.age, 21, "a new run begins at age 21");
  assert.strictEqual(state.stageId, "student", "a new run begins in the student stage");
  assert.strictEqual(state.debt, 8000, "a new run begins with real debt pressure");
  assert.strictEqual(game.STAGES.length, 6, "the career ladder has six stages");
  assert.strictEqual(game.CITIES.length, 8, "the dormant city list is preserved for the festivals stage");

  // --- selfTaught entry path (immediate, no debt, no time cost) + gig + annual debt compounding ---
  assert.strictEqual(game.startCommitment("selfTaught"), true, "selfTaught is a valid entry path");
  state = game.getState();
  assert.ok(state.pathTags.includes("self-taught"), "selfTaught tags the immediate effect");
  assert.ok(state.pathTags.includes("selfTaught"), "selfTaught tags itself as the chosen entry path");
  assert.strictEqual(state.debt, 8000, "selfTaught adds no debt");
  assert.strictEqual(state.age, 21, "selfTaught costs no time");

  const beforeGig = game.getState();
  assert.strictEqual(game.doGig("waiter"), true, "a starter gig is playable without equipment");
  state = game.getState();
  assert.strictEqual(state.age, 21.4, "a gig advances 0.4 of a year (about five months), not a full year");
  assert.ok(state.cash > beforeGig.cash, "a gig pays cash");
  const expectedDebt = Math.ceil(8000 * Math.pow(1.028, 0.4));
  assert.strictEqual(state.debt, expectedDebt, "debt compounds at the annual rate applied to the gig's fractional-year duration");

  // --- year-brief modal: briefPending lifecycle, populated from the gig that just ran ---
  assert.strictEqual(state.briefPending, true, "the gig above opened the year-brief modal");
  assert.ok(state.lastRecap, "the brief reads from lastRecap");
  assert.strictEqual(state.lastRecap.age, Math.round(state.age), "the recap reflects the (rounded) year that just passed");
  // with the fixed 0.5 random seed, this exact gig also deterministically rolls the "friend-in-trouble"
  // universal incident, queued behind the brief - same ordering as the bankruptcy case tested just below.
  assert.strictEqual(state.event && state.event.title, "חבר/ה בצרות", "this roll also deterministically queues an incident behind the brief");
  assert.strictEqual(game.closeBrief(), true, "closeBrief is a valid dismissal");
  state = game.getState();
  assert.strictEqual(state.briefPending, false, "closing the brief clears it");
  assert.ok(state.event, "the queued incident survives closing the brief");
  clearEvent(game); // drain it via its quiet no-op choice so later assertions on `game` see a clean state
  state = game.getState();
  assert.strictEqual(state.event, null, "draining the incidental incident clears it");

  // --- year-brief queues behind an incident opened by the same advanceYear call ---
  // (an isolated game instance so it doesn't disturb `game`'s cumulative cash/fame that later sections rely on)
  const bankruptGame = loadGame(path);
  bankruptGame.__testSetState({ cash: 50, debt: 1000, bank: 0 });
  assert.strictEqual(bankruptGame.startCommitment("shortCourse"), true);
  let bstate = bankruptGame.getState();
  assert.strictEqual(bstate.briefPending, true, "the brief opens even though this advanceYear call also queued a bankruptcy event");
  assert.ok(bstate.event, "the bankruptcy event is queued behind the brief, not skipped");
  assert.strictEqual(bankruptGame.closeBrief(), true);
  bstate = bankruptGame.getState();
  assert.strictEqual(bstate.briefPending, false);
  assert.strictEqual(bstate.event.title, "החוב יצא משליטה", "the queued event survives closing the brief and is still there to resolve");

  // --- gig forecast: a pre-turn preview that doesn't act until confirmed ---
  const forecastGame = loadGame(path);
  assert.strictEqual(forecastGame.startCommitment("selfTaught"), true);
  const beforeForecast = forecastGame.getState();
  assert.strictEqual(forecastGame.openGigForecast("waiter"), true, "a valid gig opens a forecast instead of acting immediately");
  let fstate2 = forecastGame.getState();
  assert.deepStrictEqual(fstate2.pendingAction, { kind: "gig", id: "waiter" });
  assert.strictEqual(fstate2.age, beforeForecast.age, "opening the forecast doesn't advance time");
  assert.strictEqual(fstate2.cash, beforeForecast.cash, "opening the forecast doesn't pay out yet");
  assert.strictEqual(forecastGame.openGigForecast("waiter"), false, "a second forecast can't open while one is already pending");

  assert.strictEqual(forecastGame.cancelPendingAction(), true);
  fstate2 = forecastGame.getState();
  assert.strictEqual(fstate2.pendingAction, null, "cancelling clears the pending forecast");
  assert.strictEqual(fstate2.cash, beforeForecast.cash, "cancelling has no side effects");
  assert.strictEqual(fstate2.age, beforeForecast.age);

  assert.strictEqual(forecastGame.openGigForecast("waiter"), true);
  assert.strictEqual(forecastGame.confirmGig(), true, "confirming executes the gig exactly like doGig");
  fstate2 = forecastGame.getState();
  assert.strictEqual(fstate2.pendingAction, null, "confirming clears the pending forecast");
  assert.strictEqual(fstate2.age, beforeForecast.age + 0.4, "confirming advances 0.4 of a year, same as a direct doGig");
  assert.strictEqual(fstate2.cash, beforeForecast.cash + 1200, "confirming pays out the gig");
  assert.strictEqual(fstate2.briefPending, true, "confirming still opens the year-brief afterward, same as a direct doGig");

  // a gig gated on missing equipment still opens the existing notice, not a forecast
  const gatedGame = loadGame(path);
  gatedGame.__testJumpToStage("industry");
  assert.strictEqual(gatedGame.openGigForecast("lineProducer"), false, "a gated gig is refused, same as doGig");
  const gstate = gatedGame.getState();
  assert.ok(gstate.event, "the missing-equipment notice opens instead of a forecast");
  assert.strictEqual(gstate.pendingAction, null);

  // --- career log: unbounded history (was capped at 6), reachable via its own view ---
  const logGame = loadGame(path);
  assert.strictEqual(logGame.startCommitment("selfTaught"), true);
  for (let i = 0; i < 10; i++) { logGame.doGig("waiter"); logGame.closeBrief(); clearEvent(logGame); } // waiter never grants fame, so a few of these cross the student stage's grace deadline and open a fallback event — drain it each time, same as the earlier fallback-path test
  assert.ok(logGame.getState().log.length > 6, "the log is no longer capped at 6 entries");
  assert.strictEqual(logGame.openView("log"), true, "the log has its own reachable view");
  assert.strictEqual(logGame.getState().view, "log");

  // --- festival-judge gig: a later-career prestige gig, breakthrough and legacy stages ---
  const judgeGame = loadGame(path);
  judgeGame.__testJumpToStage("breakthrough");
  const beforeJudge = judgeGame.getState();
  assert.strictEqual(judgeGame.doGig("festivalJudge"), true, "the festival-judge gig is playable in breakthrough");
  assert.ok(judgeGame.getState().cash > beforeJudge.cash, "it pays out");

  const judgeGame2 = loadGame(path);
  judgeGame2.__testJumpToStage("legacy");
  assert.strictEqual(judgeGame2.doGig("festivalJudge"), true, "the festival-judge gig is also playable in legacy");

  // --- rabinovichGrant: an alternate, lower-debt indie-film path with a real-world funding-politics checkpoint ---
  // high roll: keeps this checkpoint sequence free of incidental incidents, which aren't the point of this test
  const grantGame = loadGame(path, () => 0.99);
  grantGame.__testJumpToStage("indie");
  assert.strictEqual(grantGame.startCommitment("rabinovichGrant"), true);
  let gstate2 = grantGame.getState();
  assert.strictEqual(gstate2.event.title, "סעיף בחוזה המענק", "the loyalty-clause checkpoint opens first");
  assert.strictEqual(grantGame.resolveEvent(0), true, "sign-clause"); // accept the grant's clause
  gstate2 = grantGame.getState();
  assert.strictEqual(gstate2.event.title, "הסרט משוחרר");
  assert.strictEqual(grantGame.resolveEvent(0), true, "festival-track-grant");
  gstate2 = grantGame.getState();
  assert.strictEqual(gstate2.films.length, 1, "completing the grant path records a real film, same milestone as indieFilm");
  assert.ok(gstate2.awards.some((a)=>a.title.indexOf("קרן ציבורית")>=0), "completing it adds an award-cabinet entry");

  // --- political incident: a minister denounces the film sight-unseen, backlash pairs with acclaim either way ---
  const politicsGame = loadGame(path, () => 0.01); // low roll: both the 8% incident-fire chance and this incident (first in the indie pool) trigger deterministically
  politicsGame.__testJumpToStage("indie");
  politicsGame.__testSetState({ cash: 5000 });
  assert.strictEqual(politicsGame.doGig("commercialGig"), true);
  const pstate = politicsGame.getState();
  assert.strictEqual(pstate.event.title, "שר/ה מגנה את הסרט שלך");
  const beforeClap = pstate;
  assert.strictEqual(politicsGame.resolveEvent(0), true, "clap-back");
  const afterClap = politicsGame.getState();
  assert.ok(afterClap.followers > beforeClap.followers, "clapping back grows the audience despite (or because of) the controversy");
  assert.ok(afterClap.awards.some((a)=>a.title === "פרס על אף המחלוקת"));

  // --- stage-intro modal: shown at game start and re-opened on every real stage transition ---
  const introGame = loadGame(path);
  assert.strictEqual(introGame.getState().stageIntroPending, true, "a brand-new game opens with the stage-intro modal");
  assert.strictEqual(introGame.startCommitment("selfTaught"), true, "picking an entry path is a valid action while the intro is showing");
  assert.strictEqual(introGame.getState().stageIntroPending, false, "picking a path resolves the pending intro");

  for (let i = 0; i < 10 && introGame.getState().stageId === "student"; i++) { introGame.doGig("prodAssist"); clearEvent(introGame); }
  let istate = introGame.getState();
  assert.strictEqual(istate.stageId, "industry", "sanity: enough prodAssist gigs transition out of student, same milestone rule as the earlier test");
  assert.strictEqual(istate.stageIntroPending, true, "a real stage transition re-opens the stage-intro modal for the new stage");
  assert.strictEqual(introGame.closeStageIntro(), true);
  assert.strictEqual(introGame.getState().stageIntroPending, false, "closing it clears the flag");

  // --- reload mid-checkpoint: a pending checkpoint event must reopen after a page refresh, not softlock the run ---
  // two separate script contexts sharing one localStorage simulates a real page refresh (a fresh context
  // always starts from createState(), same as the browser reloading the script from scratch)
  const sharedStorage = makeMemoryStorage();
  const reloadGame1 = loadGame(path, () => 0.99, sharedStorage); // high roll keeps the year-advance to the next checkpoint free of incidental incidents
  reloadGame1.__testJumpToStage("indie");
  assert.strictEqual(reloadGame1.startCommitment("indieFilm"), true);
  assert.strictEqual(reloadGame1.resolveEvent(0), true, "genre pick resolves immediately (atYear:0), advancing straight to the next checkpoint");
  let rlState = reloadGame1.getState();
  assert.strictEqual(rlState.event.title, "התסריט מוכן", "the script checkpoint is now pending, one year into the commitment");
  assert.ok(rlState.commitment, "the commitment is still in progress, mid-checkpoint");

  const reloadGame2 = loadGame(path, () => 0.99, sharedStorage); // fresh script context, same localStorage
  assert.strictEqual(reloadGame2.getState().commitment, null, "before reloading, a brand-new context starts from createState()'s defaults");
  const reopened = reloadGame2.__testReload();
  assert.ok(reopened.commitment, "the in-progress commitment survives the reload");
  assert.ok(reopened.event, "the pending checkpoint reopens as a real event after reload, instead of leaving the run stuck with no event and no way to act");
  assert.strictEqual(reopened.event.title, "התסריט מוכן", "the reopened event is the exact checkpoint that was pending before the refresh");
  assert.strictEqual(reloadGame2.resolveEvent(1), true, "the reopened checkpoint can be resolved normally, proving the run isn't softlocked");
  assert.ok(reloadGame2.getState().pathTags.includes("script-lean"), "resolving the reopened checkpoint applies its choice like any other");

  // --- give up requires confirmation: it must not end the run on the first click ---
  const giveUpGame = loadGame(path);
  assert.strictEqual(giveUpGame.startCommitment("selfTaught"), true);
  assert.strictEqual(giveUpGame.requestGiveUp(), true, "clicking give-up opens a confirmation dialog instead of ending the run immediately");
  let guState = giveUpGame.getState();
  assert.strictEqual(guState.ended, false, "opening the confirmation alone does not end the run");
  assert.ok(guState.event, "a confirmation dialog is shown");
  assert.strictEqual(guState.event.title, "לוותר על המסלול?");
  assert.strictEqual(giveUpGame.requestGiveUp(), false, "a second confirmation can't open while one is already pending");

  assert.strictEqual(giveUpGame.resolveEvent(1), true, "cancelling"); // "להישאר במסלול"
  guState = giveUpGame.getState();
  assert.strictEqual(guState.ended, false, "cancelling keeps the run going");
  assert.strictEqual(guState.event, null, "cancelling closes the dialog with no other side effect");

  assert.strictEqual(giveUpGame.requestGiveUp(), true, "give-up can be requested again after cancelling");
  assert.strictEqual(giveUpGame.resolveEvent(0), true, "confirming give-up"); // "לוותר סופית"
  guState = giveUpGame.getState();
  assert.strictEqual(guState.ended, true, "confirming the dialog actually ends the run");
  assert.strictEqual(guState.win, false, "giving up is recorded as a loss, not a win");

  // --- difficulty: three levels, chosen once at the very start, scaling debt/events/black-market without touching DEBT_ANNUAL_RATE ---
  const freshDifficultyGame = loadGame(path);
  let fdState = freshDifficultyGame.getState();
  assert.strictEqual(fdState.difficulty, null, "a brand-new run has no difficulty chosen yet");
  assert.strictEqual(fdState.settings.difficulty, "normal", "before any explicit choice, settings already default to normal's numbers");
  assert.strictEqual(fdState.debt, 8000, "normal's default opening debt matches today's number, unchanged");

  const easyGame = loadGame(path);
  assert.strictEqual(easyGame.setDifficulty("easy"), true);
  let eState = easyGame.getState();
  assert.strictEqual(eState.difficulty, "easy");
  assert.strictEqual(eState.debt, Math.round(8000*0.6), "easy scales the opening debt to ×0.6");
  assert.strictEqual(eState.settings.eventChanceMult, 0.7, "easy scales event chance to ×0.7");
  assert.strictEqual(eState.settings.blackMarketLoan.debt, 2100, "easy keeps the black-market premium at today's rate");
  assert.strictEqual(easyGame.setDifficulty("hard"), false, "difficulty can only be chosen once");
  assert.strictEqual(easyGame.getState().difficulty, "easy", "a rejected re-choice leaves the original difficulty untouched");

  const hardGame = loadGame(path);
  assert.strictEqual(hardGame.setDifficulty("hard"), true);
  let hState = hardGame.getState();
  assert.strictEqual(hState.debt, Math.round(8000*3.0), "hard scales the opening debt to ×3.0 (tuned in the closing bankruptcy-rate gate check - see test-playthrough.js)");
  assert.strictEqual(hState.settings.eventChanceMult, 2.5, "hard scales event chance to ×2.5 (tuned alongside debtMult)");
  assert.strictEqual(hState.settings.blackMarketLoan.debt, Math.round(1500*1.55), "hard sets the black-market premium to 55%");
  assert.strictEqual(hState.settings.defaultRisk.crashChance, 0.11*2.5, "hard scales the price-event (crash) chance too");

  // DEBT_ANNUAL_RATE itself must be identical across difficulties — only the opening amount differs
  assert.strictEqual(easyGame.startCommitment("selfTaught"), true);
  assert.strictEqual(hardGame.startCommitment("selfTaught"), true);
  const easyDebtBefore = easyGame.getState().debt, hardDebtBefore = hardGame.getState().debt;
  easyGame.doGig("waiter"); hardGame.doGig("waiter"); // 0.4y each, same annual rate applied to each one's own principal
  assert.strictEqual(easyGame.getState().debt, Math.ceil(easyDebtBefore * Math.pow(1.028, 0.4)), "easy compounds at the same 1.028 annual rate as normal");
  assert.strictEqual(hardGame.getState().debt, Math.ceil(hardDebtBefore * Math.pow(1.028, 0.4)), "hard compounds at the same 1.028 annual rate as normal — difficulty never touches DEBT_ANNUAL_RATE");

  // the difficulty picker only appears once, in the very first stage's intro, before it's been chosen
  const pickerGame = loadGame(path);
  assert.strictEqual(pickerGame.STAGES[0].order, 0, "sanity: student is stage order 0");
  assert.strictEqual(pickerGame.setDifficulty("normal"), true);
  assert.strictEqual(pickerGame.getState().settings.openingDebt, 8000, "explicitly choosing normal matches the implicit default exactly");

  // --- cashScale: universal incident cash amounts scale by the current stage's cashScale (student ×1, legacy ×15) ---
  // roll 0.50 lands on the friend-in-trouble universal incident in both stages (each stage's own always-on
  // incident pool sums to the same .29 before the universal incidents are appended, so the bands line up)
  const cashScaleStudentGame = loadGame(path, () => 0.50);
  assert.strictEqual(cashScaleStudentGame.doGig("waiter"), true);
  let csState = cashScaleStudentGame.getState();
  assert.strictEqual(csState.event && csState.event.title, "חבר/ה בצרות", "sanity: this roll lands on friend-in-trouble in student stage");
  const cashBeforeHelp = csState.cash;
  assert.strictEqual(cashScaleStudentGame.resolveEvent(0), true, "help-friend");
  csState = cashScaleStudentGame.getState();
  assert.strictEqual(csState.cash, cashBeforeHelp - 400, "student stage (cashScale 1) applies the base -400 cost");

  const cashScaleLegacyGame = loadGame(path, () => 0.50);
  cashScaleLegacyGame.__testJumpToStage("legacy");
  cashScaleLegacyGame.__testSetState({ debt: 8000 }); // keep bank-call in the pool so the bands match the computation above
  assert.strictEqual(cashScaleLegacyGame.doGig("consultingLegacy"), true);
  let clState = cashScaleLegacyGame.getState();
  assert.strictEqual(clState.event && clState.event.title, "חבר/ה בצרות", "sanity: the same roll lands on the same universal incident in legacy stage");
  const cashBeforeHelpLegacy = clState.cash;
  assert.strictEqual(cashScaleLegacyGame.resolveEvent(0), true, "help-friend");
  clState = cashScaleLegacyGame.getState();
  assert.strictEqual(clState.cash, cashBeforeHelpLegacy - 400*15, "legacy stage (cashScale 15) scales the identical incident's cost to ×15");

  // --- titled price events: a good's custom events:{spike,crash} text surfaces in the year recap ---
  const eventTitleGame = loadGame(path, () => 0.01); // lands in the crash band (normal difficulty: [0,.11))
  eventTitleGame.__testJumpToStage("industry");
  let etState = eventTitleGame.getState();
  assert.strictEqual(etState.priceKinds.proCamera, "crash", "sanity: this roll produces a crash on proCamera");
  const industryStage = eventTitleGame.STAGES.find((s) => s.id === "industry");
  assert.strictEqual(industryStage.goods.find((g) => g.id === "proCamera").events.crash, "אולפן נסגר, ציוד מוצף לשוק", "proCamera carries custom crash flavor text");
  assert.strictEqual(eventTitleGame.doGig("camAssist"), true);
  etState = eventTitleGame.getState();
  const proCameraEvent = (etState.lastRecap.marketEvents || []).find((e) => e.id === "proCamera");
  assert.ok(proCameraEvent, "the year recap records proCamera's price event");
  assert.strictEqual(proCameraEvent.title, "אולפן נסגר, ציוד מוצף לשוק", "the recap uses the good's own custom title, not a generic one");

  // --- seenIncidents: an incident does not repeat within 3 years, even with the identical roll ---
  // --- followUp: an incident's followUp queues a successor that fires later, in the matching advanceYear, bypassing the normal roll ---
  const cooldownGame = loadGame(path, () => 0.25); // lands on small-scholarship (student stage, usedCamera not yet owned so camera-repair is out of the pool)
  assert.strictEqual(cooldownGame.startCommitment("selfTaught"), true);
  assert.strictEqual(cooldownGame.doGig("waiter"), true);
  let cdState = cooldownGame.getState();
  assert.strictEqual(cdState.event && cdState.event.title, "מלגה קטנה", "sanity: this roll lands on small-scholarship the first time");
  assert.strictEqual(cooldownGame.resolveEvent(1), true, "pass"); // decline; the top-level followUp still queues regardless of the choice made
  cdState = cooldownGame.getState();
  assert.ok(cdState.seenIncidents["small-scholarship"] != null, "firing the incident records it in seenIncidents");
  assert.strictEqual(cdState.queuedIncidents.length, 1, "small-scholarship's followUp queues a successor");
  assert.strictEqual(cdState.queuedIncidents[0].id, "scholarship-followup");

  assert.strictEqual(cooldownGame.doGig("waiter"), true); // identical roll, well within the 3-year cooldown
  cdState = cooldownGame.getState();
  assert.strictEqual(cdState.event && cdState.event.title, "הבנק מתקשר", "with small-scholarship on cooldown the pool shifts, so the same roll now lands on the next incident instead of repeating it");

  let followUpFired = false;
  for (let i = 0; i < 12 && !followUpFired; i++) {
    cooldownGame.doGig("waiter");
    cdState = cooldownGame.getState();
    if (cdState.event && cdState.event.title === "בדיקת מעקב מקרן המלגות") { followUpFired = true; break; }
    if (cdState.event) cooldownGame.resolveEvent(cdState.event.choices.length - 1); // drain whatever incidental incident fired, quietly
  }
  assert.ok(followUpFired, "the queued follow-up incident eventually fires once its due age is reached, ahead of the normal random roll");

  // --- minister-denounces: clap-back now costs a real contact, not a free win ---
  const politicsCostGame = loadGame(path, () => 0.01); // low roll: reliably triggers minister-denounces in the indie stage (matches the existing politics test above)
  politicsCostGame.__testJumpToStage("indie");
  politicsCostGame.__testSetState({ cash: 5000, contacts: 5 });
  assert.strictEqual(politicsCostGame.doGig("commercialGig"), true);
  const pcState = politicsCostGame.getState();
  assert.strictEqual(pcState.event.title, "שר/ה מגנה את הסרט שלך");
  assert.strictEqual(politicsCostGame.resolveEvent(0), true, "clap-back");
  const afterClapCost = politicsCostGame.getState();
  assert.strictEqual(afterClapCost.contacts, 4, "clapping back costs one contact, not a purely free upside");

  // --- passive income: no persistent assets owned -> no passive income and no breakdown ---
  const noAssetGame = loadGame(path);
  assert.strictEqual(noAssetGame.doGig("waiter"), true);
  let naState = noAssetGame.getState();
  assert.strictEqual(naState.lastRecap.passive, 0, "no owned yield-bearing assets means zero passive income");
  assert.deepStrictEqual(naState.lastRecap.passiveBreakdown, [], "and an empty breakdown, so the recap renders no passive-income line");

  // --- passive income: one flat-yield asset (productionCompanyShare, ₪2500/year) pays out scaled by elapsed years ---
  const assetGame = loadGame(path);
  assetGame.__testJumpToStage("breakthrough");
  assetGame.__testSetState({ assets: { ...assetGame.getState().assets, productionCompanyShare: true }, cash: 20000 });
  const bankBefore = assetGame.getState().bank;
  assert.strictEqual(assetGame.doGig("execProducing"), true); // 0.4y
  let aState = assetGame.getState();
  assert.strictEqual(aState.lastRecap.passive, Math.round(2500*0.4), "one flat-yield asset pays its rate × the elapsed fraction of a year");
  assert.strictEqual(aState.bank, bankBefore + Math.round(2500*0.4), "the payout lands in the bank, not cash");
  assert.deepStrictEqual(aState.lastRecap.passiveBreakdown, [{ name:"חלק בחברת הפקה", amount:Math.round(2500*0.4) }]);

  // --- passive income: per-film yields (filmRightsLibrary, distributionStake) scale with state.films.length ---
  const filmYieldGame = loadGame(path);
  filmYieldGame.__testJumpToStage("legacy");
  filmYieldGame.__testSetState({
    assets: { ...filmYieldGame.getState().assets, filmRightsLibrary: true },
    films: [{ title:"a" }, { title:"b" }], cash: 20000
  });
  assert.strictEqual(filmYieldGame.doGig("consultingLegacy"), true); // 0.4y
  let fyState = filmYieldGame.getState();
  const expectedLibraryYield = Math.round(0.03*2*4000); // FILM_RIGHTS_YIELD_RATE × films.length × FILM_RIGHTS_ASSUMED_VALUE_PER_FILM
  assert.strictEqual(fyState.lastRecap.passive, Math.round(expectedLibraryYield*0.4), "filmRightsLibrary's yield scales with the number of completed films");

  // --- personalStudio: a one-time 20% discount on the next commitment's entry debt, not a cash yield ---
  const studioGame = loadGame(path, () => 0.99); // high roll: keeps the two-year jump to filmSchool's first checkpoint free of incidental incidents
  studioGame.__testJumpToStage("student");
  studioGame.__testSetState({ assets: { ...studioGame.getState().assets, personalStudio: true }, debt: 8000 });
  assert.strictEqual(studioGame.startCommitment("filmSchool"), true); // entryDebt 16000, discounted by personalStudio -> 12800
  let stState = studioGame.getState();
  assert.strictEqual(stState.personalStudioDiscountUsed, true, "starting a commitment with entryDebt consumes the one-time discount");
  assert.strictEqual(stState.debt, 21982, "8000 + 16000*0.8 = 20800, compounded 2 years at 1.028 to reach the first checkpoint = 21982");

  // the discount is one-time: a second commitment afterward pays the full entry debt
  const studioGame2 = loadGame(path, () => 0.99);
  studioGame2.__testJumpToStage("student");
  studioGame2.__testSetState({ assets: { ...studioGame2.getState().assets, personalStudio: true }, debt: 8000, personalStudioDiscountUsed: true });
  assert.strictEqual(studioGame2.startCommitment("filmSchool"), true);
  assert.strictEqual(studioGame2.getState().debt, Math.ceil((8000+16000)*Math.pow(1.028,2)), "once already used, personalStudio no longer discounts a later commitment");

  // --- top bar: "leaving the rotation next year" predicts exactly which rotating goods/gigs the roster will drop ---
  // reuses the same industry-stage rotation facts already verified above: at stage-year 0 the active rotating
  // half is {usedMonitor,cableKit,gearCase} (goods) and {artDeptAssist,setDriver} (gigs); at stage-year 1 it's
  // {unionCard,equipmentInsurance,usedMonitor} and {droneOperator,craftServices} - so cableKit/gearCase and
  // artDeptAssist/setDriver are exactly what's leaving, while usedMonitor stays active across the boundary.
  const rotationExitGame = loadGame(path);
  rotationExitGame.__testJumpToStage("industry");
  const leavingAtYear0 = rotationExitGame.__testNextYearRotationExits();
  const expectedLeaving = ["ערכת כבלים מקצועית","עוזר/ת במחלקת אמנות","נהג/ת סט","תיק ציוד קשיח"];
  assert.strictEqual(leavingAtYear0.length, expectedLeaving.length, "exactly the four items rotating out are flagged, nothing more or less");
  expectedLeaving.forEach((name) => assert.ok(leavingAtYear0.includes(name), name + " should be flagged as leaving the rotation next year"));
  for (let i = 0; i < 3; i++) { rotationExitGame.doGig("camAssist"); clearEvent(rotationExitGame); } // cross into stage-year 1
  const leavingAtYear1 = rotationExitGame.__testNextYearRotationExits();
  assert.ok(!leavingAtYear1.includes("ערכת כבלים מקצועית"), "cableKit already rotated out, so it's not 'leaving next year' anymore");

  // --- dead choices, now with real effects: shortCourse's cert-done checkpoint ---
  const certGame = loadGame(path, () => 0.99); // high roll: keeps the 1.5-year jump to the only checkpoint free of incidental incidents
  assert.strictEqual(certGame.startCommitment("shortCourse"), true);
  let certState = certGame.getState();
  assert.strictEqual(certState.event && certState.event.title, "סיום קורס");
  assert.strictEqual(certGame.resolveEvent(0), true, "cert-done");
  certState = certGame.getState();
  assert.strictEqual(certState.contacts, 1, "completing the short course grants a contact - no longer a dead choice");

  // --- risk-camera: a real 50/50 coin flip instead of a flavor-only no-op ---
  // injects the incident's own choices directly (same technique as elsewhere in this file), so the outcome
  // is isolated from whichever roll happens to trigger the incident in the first place
  const cameraRepairChoices = [{label:"לתקן ב-₪300",kind:"repair"},{label:"לא לתקן · לסכן את המצלמה",kind:"risk-camera",quiet:true}];
  const riskCameraSuccessGame = loadGame(path, () => 0.3); // < RISK_CAMERA_SUCCESS_CHANCE (0.5) -> success
  riskCameraSuccessGame.__testSetState({ event:{ title:"המצלמה צריכה תיקון", copy:"", choices:cameraRepairChoices }, assets:{ ...riskCameraSuccessGame.getState().assets, usedCamera:false }, cash:5000 });
  assert.strictEqual(riskCameraSuccessGame.resolveEvent(1), true, "risk-camera, success roll");
  let rcState = riskCameraSuccessGame.getState();
  assert.strictEqual(rcState.assets.usedCamera, true, "a successful risk keeps/confirms the camera");
  assert.strictEqual(rcState.cash, 5000, "no cash cost on the success path");

  const riskCameraFailGame = loadGame(path, () => 0.7); // >= RISK_CAMERA_SUCCESS_CHANCE -> failure
  riskCameraFailGame.__testSetState({ event:{ title:"המצלמה צריכה תיקון", copy:"", choices:cameraRepairChoices }, cash:5000 });
  assert.strictEqual(riskCameraFailGame.resolveEvent(1), true, "risk-camera, failure roll");
  assert.strictEqual(riskCameraFailGame.getState().cash, 5000-800, "a failed risk costs ₪800");

  // --- indieFilm's script checkpoint: ambitious is now a real trade-off (+3 fame, -₪1500, and a rushed-edit risk later) ---
  function scriptChoicesFor(g) { return g.STAGES.find((s) => s.id === "indie").commitments.find((c) => c.id === "indieFilm").checkpoints.find((cp) => cp.id === "script").choices; }
  const ambitiousGame = loadGame(path);
  ambitiousGame.__testSetState({ event:{ title:"התסריט מוכן", copy:"", choices:scriptChoicesFor(ambitiousGame) }, cash:5000, fame:0 });
  assert.strictEqual(ambitiousGame.resolveEvent(0), true, "script-ambitious");
  let ambState = ambitiousGame.getState();
  assert.strictEqual(ambState.fame, 3, "script-ambitious now grants +3 fame, not the old dead +1");
  assert.strictEqual(ambState.cash, 5000-1500);

  const leanGame = loadGame(path);
  leanGame.__testSetState({ event:{ title:"התסריט מוכן", copy:"", choices:scriptChoicesFor(leanGame) }, cash:5000, fame:0 });
  assert.strictEqual(leanGame.resolveEvent(1), true, "script-lean");
  let leanState = leanGame.getState();
  assert.strictEqual(leanState.fame, 1, "script-lean still grants +1 fame");
  assert.strictEqual(leanState.cash, 5000+500, "script-lean now also grants +₪500, no longer a dead upside");

  // --- the edit checkpoint: an ambitious script raises the odds edit-rough backfires; a lean one never does ---
  // editChoices must come from the SAME instance resolveEvent runs on: the choice's effect() closes over
  // that instance's own Math.random/addLog, so choices borrowed from a different loadGame() would silently
  // roll against the wrong (default 0.5) RNG instead of this test's injected one
  function editChoicesFor(g) { return g.STAGES.find((s) => s.id === "indie").commitments.find((c) => c.id === "indieFilm").checkpoints.find((cp) => cp.id === "edit").choices; }
  const rushBackfireGame = loadGame(path, () => 0.3); // < EDIT_RUSH_RISK_CHANCE (0.5) -> the rush backfires
  rushBackfireGame.__testSetState({ pathTags:["script-ambitious"], fame:10, commitment:null, event:{ title:"משמרות עריכה", copy:"", choices:editChoicesFor(rushBackfireGame) } });
  assert.strictEqual(rushBackfireGame.resolveEvent(1), true, "edit-rough after an ambitious script, low roll");
  assert.strictEqual(rushBackfireGame.getState().fame, 8, "an ambitious script plus rushing the edit now has a real downside (-2 fame)");

  const rushSafeGame = loadGame(path, () => 0.7); // >= EDIT_RUSH_RISK_CHANCE -> the rush does not backfire
  rushSafeGame.__testSetState({ pathTags:["script-ambitious"], fame:10, commitment:null, event:{ title:"משמרות עריכה", copy:"", choices:editChoicesFor(rushSafeGame) } });
  assert.strictEqual(rushSafeGame.resolveEvent(1), true, "edit-rough after an ambitious script, high roll");
  assert.strictEqual(rushSafeGame.getState().fame, 10, "the risk doesn't always land");

  const rushLeanGame = loadGame(path, () => 0.3); // same low roll, but no script-ambitious tag -> the risk never applies
  rushLeanGame.__testSetState({ pathTags:["script-lean"], fame:10, commitment:null, event:{ title:"משמרות עריכה", copy:"", choices:editChoicesFor(rushLeanGame) } });
  assert.strictEqual(rushLeanGame.resolveEvent(1), true, "edit-rough after a lean script");
  assert.strictEqual(rushLeanGame.getState().fame, 10, "without script-ambitious, edit-rough is never risky, regardless of the roll");

  // --- buy: asset vs. bag, capacity ---
  assert.strictEqual(game.buy("usedCamera"), true, "an asset-flagged good can be bought");
  state = game.getState();
  assert.strictEqual(state.assets.usedCamera, true, "an asset purchase is written to state.assets");
  assert.strictEqual(Object.keys(state.bag).length, 0, "an asset purchase never enters the temporary bag");
  assert.strictEqual(game.buy("usedCamera"), false, "a second purchase of an owned asset is refused");
  clearEvent(game); // the refusal opens a dismissible notice, same as every other "can't do this" message

  assert.strictEqual(game.buy("scriptRights"), true, "a non-asset good is bought into the bag");
  state = game.getState();
  assert.strictEqual(state.bag.scriptRights, 1, "the bag tracks quantity");

  // --- milestone-driven stage transition + automatic liquidation of irrelevant bag goods ---
  // required milestones (fame>=6, cash+bank>=5000) take several gigs, not one, to reach
  const beforeTransition = game.getState();
  assert.strictEqual(game.doGig("prodAssist"), true, "the credit-and-contacts gig can be repeated");
  clearEvent(game); // an incidental incident can fire on any gig now that the pool is larger - drain it so the next gig isn't guard-blocked
  assert.strictEqual(game.doGig("prodAssist"), true);
  clearEvent(game);
  state = game.getState();
  assert.strictEqual(state.stageId, "student", "two gigs are not yet enough to meet both required milestones");
  assert.strictEqual(game.doGig("prodAssist"), true);
  clearEvent(game);
  state = game.getState();
  assert.strictEqual(state.stageId, "industry", "meeting both required milestones after enough gigs transitions to the next stage automatically");
  assert.strictEqual(state.bag.scriptRights, undefined, "a bag good irrelevant to the next stage is liquidated on transition");
  assert.ok(state.cash > beforeTransition.cash + 700 - 1, "the gig payout plus the liquidation value both landed in cash");
  assert.ok(state.log.some((line) => line.indexOf("מומש אוטומטית") === 0), "the liquidation is logged transparently");
  assert.strictEqual(state.assets.usedCamera, true, "assets survive the stage transition untouched");

  // --- filmSchool: multi-year commitment with two internal checkpoints ---
  game.newGame();
  assert.strictEqual(game.startCommitment("filmSchool"), true, "filmSchool is a valid entry path");
  state = game.getState();
  assert.ok(state.commitment, "a multi-year commitment is tracked on state");
  assert.strictEqual(state.commitment.id, "filmSchool");
  drainIncidental(game, "בחירת התמחות"); // a two-year jump can also roll a plain incident before this checkpoint opens
  state = game.getState();
  assert.ok(state.event, "the first checkpoint opens as a real event, not silently");
  assert.strictEqual(state.event.title, "בחירת התמחות");
  assert.strictEqual(state.age, 23, "the commitment advanced two years to reach the first checkpoint in one action");
  assert.ok(state.debt > 24000, "entry debt (8000+16000) compounded over the two elapsed years");

  assert.strictEqual(game.resolveEvent(0), true, "בימוי");
  state = game.getState();
  assert.ok(state.pathTags.includes("spec-directing"), "the checkpoint choice is recorded");
  assert.strictEqual(state.contacts, 1, "specializing grants a contact, regardless of which specialization is picked");
  assert.ok(state.event, "the second checkpoint opens automatically after the first resolves");
  // two more full years pass with zero chance to touch the bank mid-commitment -> the debt-collector's
  // 3-year-neglect threshold trips here; draining it lets progressCommitment reach the real checkpoint
  // right after, with no extra time cost (elapsedYears was already bumped before the interruption fired)
  drainIncidental(game, "פרויקט גמר"); state = game.getState();
  assert.strictEqual(state.event.title, "פרויקט גמר");
  assert.strictEqual(state.age, 25, "the commitment advanced to the second checkpoint at year 4");

  assert.strictEqual(game.resolveEvent(0), true, "פרויקט שאפתני");
  state = game.getState();
  assert.ok(state.pathTags.includes("thesis-ambitious"), "the second checkpoint choice is recorded");
  assert.ok(state.pathTags.includes("filmSchool"), "completing the commitment tags the chosen entry path");
  assert.strictEqual(state.assets.diploma, true, "film school grants the diploma asset on completion");
  assert.strictEqual(state.fame, 4, "2(thesis choice) + 2(grantsOnComplete) = 4 - the thesis checkpoint is no longer a dead choice");
  assert.strictEqual(state.commitment, null, "the commitment clears once complete");
  assert.strictEqual(state.stageId, "student", "the diploma's fame grant alone is not enough to meet the higher milestone bar — the stage stays open for more play");

  // --- fallback path: required milestones never met before the grace deadline ---
  // grace deadline is age 29 (ageRange[1]=26 + STAGE_GRACE_YEARS=3); at 0.4y/gig that's 20 gigs from age 21.
  // never paying down debt over that stretch also trips the debt-collector every ~3 years of neglect, and
  // with a much bigger incident pool a plain incident fires on most gigs too - drain those (and any other
  // incident) so the grind toward the real fallback event can continue. With ~1 drain-only iteration per
  // real gig, budget well past the ~20 gigs actually needed.
  game.newGame();
  for (let i = 0; i < 100; i++) {
    const s = game.getState();
    if (s.event && s.event.title === "השלב לא הושלם כמתוכנן") break; // the real fallback event - stop and let the assertions below inspect it
    if (s.event) { game.resolveEvent(s.event.choices.length - 1); continue; } // drain a debt-collector visit or other incident, then keep grinding
    if (!game.doGig("waiter")) break; // waiter never grants fame, so first-credit stays unmet
  }
  state = game.getState();
  assert.ok(state.event, "missing the required milestones past the grace period opens a fallback event");
  assert.strictEqual(state.event.title, "השלב לא הושלם כמתוכנן");
  assert.strictEqual(state.ended, false, "a missed milestone does not end the run");
  assert.strictEqual(game.resolveEvent(0), true, "עבודה מסחרית קבועה");
  state = game.getState();
  assert.strictEqual(state.stageId, "industry", "choosing a fallback still advances the stage");
  assert.ok(state.pathTags.includes("commercial"), "the fallback effect is applied and recorded");

  // --- bankruptcy: real risk with a bounded rescue path ---
  game.newGame();
  game.__testSetState({ cash: 50, debt: 1000, bank: 0 });
  assert.strictEqual(game.startCommitment("shortCourse"), true, "a commitment can still start while cash is critically low");
  state = game.getState();
  assert.ok(state.event, "an out-of-control debt ratio opens a rescue event instead of ending the run immediately");
  assert.strictEqual(state.event.title, "החוב יצא משליטה");
  assert.strictEqual(state.ended, false);
  assert.strictEqual(game.resolveEvent(0), true, "הלוואת חירום");
  state = game.getState();
  assert.strictEqual(state.bankruptcyStrikes, 1, "taking the rescue loan counts as one strike");
  assert.strictEqual(state.ended, false, "one strike does not end the run");
  clearEvent(game); // the rescue loan's cash injection can itself complete the pending checkpoint/milestones — settle whatever follows before moving on

  // isolated fresh run: the 4th crisis, with strikes already exhausted, ends the run instead of rescuing again
  game.newGame();
  game.__testSetState({ cash: 50, bank: 0, bankruptcyStrikes: 5, debt: 100000 });
  assert.strictEqual(game.startCommitment("filmSchool"), true);
  state = game.getState();
  assert.strictEqual(state.ended, true, "a fourth debt crisis ends the run instead of offering another rescue");
  assert.strictEqual(state.win, false);

  // --- industry stage: gated gig, milestone transition, and liquidation into the still-stub indie stage ---
  game.newGame();
  game.__testJumpToStage("industry");
  assert.strictEqual(game.getState().age, 26, "jumping to industry starts at its own entry age");
  assert.strictEqual(game.doGig("lineProducer"), false, "a gig gated on a good the player doesn't own yet is refused");
  clearEvent(game);
  assert.strictEqual(game.buy("crewFavor"), true, "the gating good can be bought");
  for (let i = 0; i < 14 && game.getState().stageId === "industry"; i++) { game.doGig("lineProducer"); clearEvent(game); } // needs:{crewFavor:1} only gates presence, not consumption — one purchase covers all fourteen; clearEvent drains any incident so the loop doesn't stall
  state = game.getState();
  assert.strictEqual(state.stageId, "indie", "industry's own required milestones (fame>=22, contacts>=18) transition into indie");
  assert.strictEqual(state.bag.crewFavor, undefined, "the gating good is liquidated on transition since indie (still a stub) has no matching good");
  assert.ok(state.log.some((line) => line.indexOf("מומש אוטומטית") === 0));

  // --- industry stage: rotating gigs/goods (pilot of the market-rotation mechanic) ---
  // deterministic (keyed on stageYear, not RNG) so this needs no seeded Math.random to assert on exactly.
  const rotGame = loadGame(path);
  rotGame.__testJumpToStage("industry");
  let rotState = rotGame.getState();
  assert.deepStrictEqual(rotState.activeGigs, ["camAssist","gaffer","freelanceEditor","lineProducer","artDeptAssist","setDriver"],
    "at stage-year 0, the core gigs are all active plus the first half of the rotating pool");
  assert.strictEqual(rotState.prices.unionCard, null, "a rotating good outside this year's roster reads as unavailable");
  assert.strictEqual(rotState.priceKinds.unionCard, "unavailable");
  assert.ok(rotState.prices.usedMonitor > 0, "a rotating good inside this year's roster has a real price");

  assert.strictEqual(rotGame.doGig("droneOperator"), false, "a rotating gig outside this year's roster is refused, same as a gated gig");
  rotState = rotGame.getState();
  assert.strictEqual(rotState.event.title, "לא זמינה השנה");
  clearEvent(rotGame);

  for (let i = 0; i < 3; i++) { rotGame.doGig("camAssist"); clearEvent(rotGame); } // 3*0.4y = 1.2y, crossing into stage-year 1's window
  rotState = rotGame.getState();
  assert.deepStrictEqual(rotState.activeGigs, ["camAssist","gaffer","freelanceEditor","lineProducer","droneOperator","craftServices"],
    "a year later, the rotating half of the roster has fully swapped to the other two gigs");
  assert.strictEqual(rotGame.doGig("artDeptAssist"), false, "the gig that was active last year is now the one that's rotated out");
  clearEvent(rotGame);
  assert.strictEqual(rotGame.doGig("droneOperator"), true, "the newly-rotated-in gig is playable");

  // --- indie stage: the full film-production flow (genre -> script -> cast -> shoot -> edit -> distribution -> poster), films.push on completion, milestone transition ---
  game.newGame();
  game.__testJumpToStage("indie");
  assert.strictEqual(game.startCommitment("indieFilm"), true);
  state = game.getState();
  assert.strictEqual(state.event.title, "לבחור ז'אנר", "production opens on a genre pick before any time passes");
  assert.strictEqual(game.resolveEvent(0), true, "דרמה"); // genre-drama: fame+1, filmDraft.genre="דרמה"
  drainIncidental(game, "התסריט מוכן"); state = game.getState();
  assert.strictEqual(state.fame, 1, "a checkpoint choice's effect() applies immediately, not just its pathTag");
  assert.strictEqual(state.event.title, "התסריט מוכן");
  assert.strictEqual(game.resolveEvent(1), true, "להישאר רזים ויעילים"); // script-lean: fame+1
  drainIncidental(game, "מי מככב/ת?"); state = game.getState();
  assert.strictEqual(state.fame, 2);
  assert.strictEqual(state.event.title, "מי מככב/ת?", "casting is its own real decision, not folded into the shoot checkpoint");
  assert.strictEqual(game.resolveEvent(0), true, "כוכב/ת מוכר/ת"); // cast-star: -2000 cash, fame+2, followers+500, sets filmDraft.starName
  drainIncidental(game, "הצילומים מסתיימים"); state = game.getState();
  assert.strictEqual(state.fame, 4);
  assert.strictEqual(state.event.title, "הצילומים מסתיימים");
  assert.strictEqual(game.resolveEvent(1), true, "לעצור בתקציב"); // on-budget: cash+500
  drainIncidental(game, "משמרות עריכה"); state = game.getState();
  assert.strictEqual(state.event.title, "משמרות עריכה", "editing shifts are their own checkpoint after the shoot wraps");
  assert.strictEqual(game.resolveEvent(1), true, "לסגור בגרסה הראשונה"); // edit-rough: no effect
  drainIncidental(game, "בחירת הפצה"); state = game.getState();
  assert.strictEqual(state.event.title, "בחירת הפצה");
  assert.strictEqual(game.resolveEvent(0), true, "מסלול פסטיבלים"); // festival-track: achievements flag + fame+2
  drainIncidental(game, "הסרט יוצא לאקרנים"); state = game.getState();
  assert.strictEqual(state.achievements["festival-invite"], true, "the festival-track checkpoint choice sets the flag festivals-stage flights will read");
  assert.strictEqual(state.event.title, "הסרט יוצא לאקרנים", "the finished production ends on a poster reveal, right after distribution, no time elapsed between them");
  assert.ok(state.event.html && state.event.html.indexOf("poster-card") !== -1, "the poster checkpoint renders a real poster card, not plain text");
  assert.ok(state.event.html.indexOf("גיא") !== -1, "the poster credits the cast choice actually made (fixed RNG picks a reproducible actor name)");
  assert.strictEqual(game.resolveEvent(0), true, "להמשיך ←"); // poster-ack: no effect, just closes the reveal
  state = game.getState();
  assert.strictEqual(state.films.length, 1, "completing the indieFilm commitment records a real film asset");
  assert.strictEqual(state.films[0].genre, "דרמה", "the film record carries the genre actually chosen, not a hardcoded default");
  assert.strictEqual(state.films[0].starring, "גיא", "the film record carries the cast choice actually made");
  assert.strictEqual(state.fame, 10, "1(drama)+1(script-lean)+2(cast-star)+0(on-budget)+0(edit-rough)+2(festival-track)+4(grantsOnComplete) = 10");
  assert.strictEqual(state.stageId, "festivals", "both required milestones (a finished film, basic solvency) are met on completion");

  // --- __testJumpToStage seam (needed by the future festivals-stage test block) ---
  game.newGame();
  const jumped = game.__testJumpToStage("legacy");
  assert.strictEqual(jumped.stageId, "legacy");
  assert.strictEqual(jumped.age, 65, "jumping to a stage resets age to that stage's starting age");

  // --- festivals stage: rare flight invites, gated by a fixed RNG that clears the 30% offer threshold ---
  // the player picks which city to fly to (or declines) — every unvisited flight city is offered, not one random pick
  const flightGame = loadGame(path, () => 0.01);
  flightGame.__testJumpToStage("festivals");
  flightGame.__testSetState({ cash: 5000 });
  assert.strictEqual(flightGame.doGig("consultingGig"), true);
  let fstate = flightGame.getState();
  assert.ok(fstate.event, "a flight invite can appear on any year-advancing action once the stage is festivals");
  assert.strictEqual(fstate.event.title, "הוזמנת לפסטיבל");
  assert.strictEqual(fstate.event.choices.length, 6, "all 5 flight cities are offered as choices, plus declining");
  assert.strictEqual(fstate.event.choices[fstate.event.choices.length - 1].kind, "decline-flight", "declining is always the last, quiet choice");
  const cityId = fstate.event.choices[0].cityId;
  assert.strictEqual(cityId, "athens", "cities are offered in a fixed order, athens first");
  const beforeFlight = fstate;
  assert.strictEqual(flightGame.resolveEvent(0), true, "accepting the flight");
  fstate = flightGame.getState();
  assert.strictEqual(fstate.achievements["visited-athens"], true, "a visited city is recorded so it won't be offered again");
  assert.ok(fstate.cash < beforeFlight.cash, "the flight fare was charged");
  assert.ok(fstate.fame > beforeFlight.fame, "the trip pays off in reputation");

  // --- fame decay: reputation fades after 4 years without completing a project (any commitment), in any stage ---
  // festivals' consultingGig grants fame:0, so repeating it isolates the decay effect from gig fame gains;
  // fame:100 already clears festivals' own fame gate (60) but followers (0) stays well under its other gate (3000),
  // so the stage never transitions mid-grind; high roll also keeps the rare flight-invite (only in festivals) from firing
  const decayGame = loadGame(path, () => 0.99);
  decayGame.__testJumpToStage("festivals");
  decayGame.__testSetState({ fame: 100, cash: 5000, debt: 0 }); // debt:0 keeps the debt-collector and bankruptcy checks fully out of the way
  for (let i = 0; i < 9; i++) { assert.strictEqual(decayGame.doGig("consultingGig"), true); clearEvent(decayGame); } // 9*0.4 = 3.6y, under the 4-year threshold
  let dState = decayGame.getState();
  assert.strictEqual(dState.fame, 100, "fame does not decay before 4 years without a completed project");
  for (let i = 0; i < 4; i++) { assert.strictEqual(decayGame.doGig("consultingGig"), true); clearEvent(decayGame); } // +4*0.4 = 5.2y total, one whole year past the 4-year mark
  dState = decayGame.getState();
  assert.strictEqual(dState.fame, Math.floor(100 * Math.pow(1 - 0.03, 1)), "one whole year past the 4-year mark applies exactly one 3% decay tick");
  assert.ok(dState.fame < 100, "sanity: the decay actually reduced fame");

  // --- rule: legacyRecommend's guidance threshold must match the real "mentee" milestone gate exactly ---
  // (the project's recurring bug class is a recommend() threshold sitting below the real milestone gate)
  const gateGame = loadGame(path, () => 0.99);
  gateGame.__testJumpToStage("legacy");
  gateGame.__testSetState({ fame: 150, films: [{ title: "a" }, { title: "b" }], pathTags: ["legacyFilm"] }); // capstone-film already met; only mentee left
  let gState = gateGame.getState();
  const legacyStage = gateGame.STAGES.find((s) => s.id === "legacy");
  assert.strictEqual(legacyStage.milestones.find((m) => m.id === "mentee").check(gState), false, "the real mentee gate: still unmet");
  assert.strictEqual(legacyStage.recommend(gState).title, "להנחיל את הידע הלאה", "recommend still points at the mentee gap while it's genuinely unmet, not a false 'ready to finish'");
  assert.strictEqual(gateGame.doGig("festivalJudge"), true, "festivalJudge is also tagged as a mentorship/judging gig");
  gState = gateGame.getState();
  assert.strictEqual(gState.achievements.mentored, true, "the gig satisfied the mentee milestone");
  assert.strictEqual(gState.ended, true, "with capstone-film already met, satisfying mentee alone now ends the run — recommend's gate and the real gate agree exactly, with no third hidden requirement");

  // --- full-life win: legacy is the last stage, so meeting its required milestones ends the run in victory ---
  game.newGame();
  game.__testJumpToStage("legacy");
  game.__testSetState({ fame: 95, films: [{ title: "הסרט העצמאי הראשון" }] });
  assert.strictEqual(game.startCommitment("legacyFilm"), true);
  state = game.getState();
  assert.strictEqual(state.event.title, "לבחור ז'אנר", "the capstone film still opens on a genre pick, even in its leaner two-decision flow");
  assert.strictEqual(game.resolveEvent(0), true, "דרמה"); // genre-drama: fame+1 -> 96
  drainIncidental(game, "לבחור נושא אישי"); state = game.getState();
  assert.strictEqual(state.event.title, "לבחור נושא אישי");
  assert.strictEqual(game.resolveEvent(0), true, "הסיפור הכי אישי שלך"); // fame+2 -> 98
  drainIncidental(game, "העמדה מול קהל"); state = game.getState();
  assert.strictEqual(state.event.title, "העמדה מול קהל");
  assert.strictEqual(game.resolveEvent(0), true, "הקרנת יחיד בפסטיבל הבית"); // fame+3 -> 101
  state = game.getState();
  assert.strictEqual(state.event.title, "הסרט יוצא לאקרנים", "the capstone film also ends on a poster reveal");
  assert.ok(state.event.html && state.event.html.indexOf("קובי") !== -1, "with no cast checkpoint of its own, the legacy poster credits the player as star");
  assert.strictEqual(game.resolveEvent(0), true, "להמשיך ←"); // poster-ack -> completeCommitment grants +5 -> 106
  state = game.getState();
  assert.strictEqual(state.films.length, 2, "the legacy film is a second real film asset");
  assert.strictEqual(state.films[1].starring, "קובי");
  assert.strictEqual(state.fame, 106, "95 + 1(drama) + 2(personal-story) + 3(solo-screening) + 5(grantsOnComplete) = 106");
  assert.strictEqual(state.ended, false, "completing the capstone film alone is not enough — the mentee milestone (a mentorship/judging gig) is still unmet");
  assert.strictEqual(game.doGig("teachingGig"), true, "teaching is a mentorship gig that satisfies the mentee milestone"); // fame+2 -> 108
  state = game.getState();
  assert.strictEqual(state.achievements.mentored, true, "a mentorship/judging gig marks the mentee milestone");
  assert.strictEqual(state.ended, true, "meeting both required milestones (capstone film + mentee) ends the run — there is no seventh stage");
  assert.strictEqual(state.win, true, "reaching the end of the career ladder is a win, not a timer running out");
  assert.ok(state.final && state.final.achievement > 0, "a final achievement score is computed on completion");
  assert.strictEqual(typeof state.final.financial, "number", "a separate financial score is also computed — money is not the score");

  // --- local high-score table: recorded on finish(), sorted best-first, capped at 10 ---
  // a fresh instance, since `game` above already finished once earlier (the bankruptcy-strikes-exhausted test) and scores persist across game.newGame() within the same session, by design
  const winScoreGame = loadGame(path);
  winScoreGame.__testJumpToStage("legacy");
  winScoreGame.__testSetState({ fame: 95, films: [{ title: "הסרט העצמאי הראשון" }] });
  winScoreGame.startCommitment("legacyFilm");
  winScoreGame.resolveEvent(0); // genre
  drainIncidental(winScoreGame, "לבחור נושא אישי");
  winScoreGame.resolveEvent(0); // theme
  drainIncidental(winScoreGame, "העמדה מול קהל");
  winScoreGame.resolveEvent(0); // release
  drainIncidental(winScoreGame, "הסרט יוצא לאקרנים");
  winScoreGame.resolveEvent(0); // poster-ack -> completeCommitment (mentee still unmet, run doesn't end yet)
  winScoreGame.doGig("teachingGig"); // mentorGig -> mentee milestone met -> finish(true)
  const winState = winScoreGame.getState();
  let scores = winScoreGame.loadScores();
  assert.strictEqual(scores.length, 1, "finishing a run records exactly one score entry");
  assert.strictEqual(scores[0].achievement, winState.final.achievement, "the recorded score matches the run's final achievement score");
  assert.strictEqual(scores[0].financial, winState.final.financial);
  assert.strictEqual(scores[0].win, true);
  assert.strictEqual(scores[0].stage, "מורשת ופרישה");

  const scoreGame = loadGame(path);
  scoreGame.__testSetState({ cash: 50, bank: 0, bankruptcyStrikes: 5, debt: 100000 });
  assert.strictEqual(scoreGame.startCommitment("filmSchool"), true, "the fourth debt crisis ends the run (loss) and should still record a score");
  const lossScores = scoreGame.loadScores();
  assert.strictEqual(lossScores.length, 1);
  assert.strictEqual(lossScores[0].win, false, "a loss records win:false, not just wins");

  // --- RNG-injected price events (crash / spike / unavailable) ---
  // excludes rotating goods: those force kind:"unavailable" whenever they're outside this year's roster,
  // regardless of the price roll, which isn't what this block is testing (see the rotation block below).
  // normal difficulty bands: crash [0,.11), spike [.11,.22), unavailable [.22,.25), normal [.25,1)
  const studentGoods = game.STAGES[0].goods.filter((g) => !g.rotates);
  const crashState = loadGame(path, () => 0.01).getState();
  assertAllKind(crashState, studentGoods, "crash");
  const spikeState = loadGame(path, () => 0.15).getState();
  assertAllKind(spikeState, studentGoods, "spike");
  const unavailGame = loadGame(path, () => 0.23);
  const unavailState = unavailGame.getState();
  assertAllKind(unavailState, studentGoods, "unavailable");
  studentGoods.forEach((g) => assert.strictEqual(unavailState.prices[g.id], null, g.id + " has no price while unavailable"));

  // --- bank: pay off the full debt balance in one action ---
  const payoffGame = loadGame(path);
  payoffGame.startCommitment("selfTaught");
  payoffGame.__testSetState({ cash: 20000, debt: 8000 });
  assert.strictEqual(payoffGame.bank("payAll"), true, "a full payoff succeeds when cash covers the whole debt");
  let payoffState = payoffGame.getState();
  assert.strictEqual(payoffState.debt, 0, "the entire debt balance is cleared, not just a fraction of it");
  assert.strictEqual(payoffState.cash, 12000, "the exact debt amount is deducted from cash, no more");

  payoffGame.__testSetState({ cash: 100, debt: 5000 });
  assert.strictEqual(payoffGame.bank("payAll"), false, "a full payoff is refused when cash can't cover the whole debt");
  clearEvent(payoffGame);
  assert.strictEqual(payoffGame.getState().debt, 5000, "a refused payoff leaves the debt untouched");

  payoffGame.__testSetState({ debt: 0 });
  assert.strictEqual(payoffGame.bank("payAll"), false, "paying off an already-zero debt is refused rather than a silent no-op");
  clearEvent(payoffGame);

  // --- the "bank calls" incident only fires while there's real debt to collect on ---
  // roll 0.32 lands on bank-call's band when debt>0 (pool: gig-falls-through[0,.08) cheap-gear[.08,.16)
  // friends-project[.16,.23) small-scholarship[.23,.29) bank-call[.29,.39) road-gig[.39,.47) ...),
  // and on road-gig's shifted band when debt=0 filters bank-call out of the pool entirely
  const bankCallGame = loadGame(path, () => 0.32);
  bankCallGame.startCommitment("selfTaught");
  bankCallGame.doGig("waiter");
  assert.strictEqual(bankCallGame.getState().event.title, "הבנק מתקשר", "the bank still calls about real debt");

  const noDebtCallGame = loadGame(path, () => 0.32);
  noDebtCallGame.startCommitment("selfTaught");
  noDebtCallGame.__testSetState({ debt: 0 });
  noDebtCallGame.doGig("waiter");
  const noDebtState = noDebtCallGame.getState();
  assert.notStrictEqual(noDebtState.event && noDebtState.event.title, "הבנק מתקשר", "the bank has nothing to call about once debt is zero");
  assert.strictEqual(noDebtState.debt, 0, "a zero balance can't be pushed back into debt by a phantom collection call");

  // --- debt collector: a time-based (not ratio-based) escalating threat for sustained neglect ---
  const collectorGame = loadGame(path);
  collectorGame.startCommitment("selfTaught");

  collectorGame.__testSetState({ debt: 5000, debtCollectorStreak: 2.5 });
  assert.strictEqual(collectorGame.doGig("waiter"), true);
  let cState = collectorGame.getState();
  assert.ok(!cState.event || cState.event.title !== "אזהרה מההוצאה לפועל", "under the 3-year neglect threshold, the collector stays away");
  clearEvent(collectorGame); // a plain incident can also have fired on this gig - drain it before reusing this instance below

  collectorGame.__testSetState({ debt: 5000, debtCollectorStreak: 0, debtCollectorIgnores: 0 });
  collectorGame.__testSetState({ debtCollectorStreak: 3 });
  assert.strictEqual(collectorGame.doGig("waiter"), true);
  cState = collectorGame.getState();
  assert.strictEqual(cState.event && cState.event.title, "אזהרה מההוצאה לפועל", "3 full years of unpaid debt above the floor summons the collector");
  assert.strictEqual(cState.event.copy.indexOf("הפעם הראשונה"), -1, "the first visit reads as a warning, not a repeat-offender callout");

  const debtBeforePay = cState.debt;
  assert.strictEqual(collectorGame.resolveEvent(0), true, "collector-pay");
  cState = collectorGame.getState();
  assert.ok(cState.debt < debtBeforePay, "paying the collector actually reduces the debt");
  assert.strictEqual(cState.debtCollectorStreak, 0, "a real payment resets the neglect clock");
  assert.strictEqual(cState.debtCollectorIgnores, 0, "a real payment also clears the escalation count, not just the clock");

  collectorGame.__testSetState({ debt: 1000, debtCollectorStreak: 10 });
  assert.strictEqual(collectorGame.doGig("waiter"), true);
  cState = collectorGame.getState();
  assert.ok(!cState.event || cState.event.title !== "אזהרה מההוצאה לפועל", "below the minimum debt floor, the collector has nothing worth collecting");
  assert.strictEqual(cState.debtCollectorStreak, 0, "dropping under the floor resets the streak outright, same as paying");
  clearEvent(collectorGame); // a plain incident can also have fired on this gig - drain it before reusing this instance below

  collectorGame.__testSetState({ debt: 5000, debtCollectorStreak: 3, debtCollectorIgnores: 0 });
  assert.strictEqual(collectorGame.doGig("waiter"), true);
  cState = collectorGame.getState();
  assert.strictEqual(cState.event.title, "אזהרה מההוצאה לפועל");
  const debtBeforeIgnore = cState.debt;
  assert.strictEqual(collectorGame.resolveEvent(1), true, "collector-ignore, 1st time");
  cState = collectorGame.getState();
  assert.ok(cState.debt > debtBeforeIgnore, "ignoring costs a real debt penalty instead of being free");
  assert.strictEqual(cState.debtCollectorIgnores, 1, "a single ignore is tracked but doesn't yet count as a bankruptcy strike");
  assert.strictEqual(cState.bankruptcyStrikes, 0, "one ignore alone is a warning, not a strike");

  collectorGame.__testSetState({ debtCollectorStreak: 3 }); // a second full neglect stretch, without ever paying in between
  assert.strictEqual(collectorGame.doGig("waiter"), true);
  cState = collectorGame.getState();
  assert.strictEqual(cState.event.title, "אזהרה מההוצאה לפועל");
  assert.notStrictEqual(cState.event.copy.indexOf("הפעם הראשונה"), -1, "a repeat visit reads as an escalation, not a fresh warning");
  assert.strictEqual(collectorGame.resolveEvent(1), true, "collector-ignore, 2nd time");
  cState = collectorGame.getState();
  assert.strictEqual(cState.debtCollectorIgnores, 2);
  assert.strictEqual(cState.bankruptcyStrikes, 1, "a second consecutive ignore now counts toward the same bankruptcy-strike limit as the ratio-based crisis");

  // --- the strike limit is a real hard cap, not just a ratio-crisis-time check ---
  // every consecutive ignore from the 2nd onward adds a strike; keep ignoring past the 5-strike limit
  // purely via the debt collector, with no ratio-based crisis ever active, and confirm it still ends the run
  for (let ignoreNum = 3; ignoreNum <= 5; ignoreNum++) {
    collectorGame.__testSetState({ debtCollectorStreak: 3 });
    assert.strictEqual(collectorGame.doGig("waiter"), true);
    cState = collectorGame.getState();
    assert.strictEqual(cState.event.title, "אזהרה מההוצאה לפועל");
    assert.strictEqual(collectorGame.resolveEvent(1), true, "collector-ignore, " + ignoreNum + "th time");
    cState = collectorGame.getState();
    assert.strictEqual(cState.bankruptcyStrikes, ignoreNum - 1);
    assert.strictEqual(cState.ended, false, (ignoreNum - 1) + " strikes alone still doesn't end the run");
  }

  collectorGame.__testSetState({ debtCollectorStreak: 3 });
  assert.strictEqual(collectorGame.doGig("waiter"), true);
  cState = collectorGame.getState();
  assert.strictEqual(cState.event.title, "אזהרה מההוצאה לפועל");
  assert.ok(cState.cash >= 100, "sanity: no ratio-based crisis is active here (cash isn't critically low) - this is a pure debt-collector-driven ending");
  assert.strictEqual(collectorGame.resolveEvent(1), true, "collector-ignore, 6th time");
  cState = collectorGame.getState();
  assert.strictEqual(cState.bankruptcyStrikes, 5, "the fifth strike, accrued purely from repeated collector visits");
  assert.strictEqual(cState.ended, true, "hitting the strike limit ends the run immediately even with no ratio-based crisis active - closes the gap where strikes could silently exceed the limit");
  assert.strictEqual(cState.win, false);
}

if (require.main === module) {
  run(process.argv[2] || "studio-mogul-dope-wars.html");
  console.log("test-night-market: ok");
}

module.exports = { run };
