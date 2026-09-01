const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

function loadGame(htmlPath, randomFn) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const match = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  assert.ok(match, "the game has a playable inline script");
  const context = { console, Math: Object.create(Math), JSON, Intl };
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
  assert.strictEqual(game.doGig("prodAssist"), true);
  state = game.getState();
  assert.strictEqual(state.stageId, "student", "two gigs are not yet enough to meet both required milestones");
  assert.strictEqual(game.doGig("prodAssist"), true);
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
  assert.ok(state.event, "the first checkpoint opens as a real event, not silently");
  assert.strictEqual(state.event.title, "בחירת התמחות");
  assert.strictEqual(state.age, 23, "the commitment advanced two years to reach the first checkpoint in one action");
  assert.ok(state.debt > 24000, "entry debt (8000+16000) compounded over the two elapsed years");

  assert.strictEqual(game.resolveEvent(0), true, "בימוי");
  state = game.getState();
  assert.ok(state.pathTags.includes("spec-directing"), "the checkpoint choice is recorded");
  assert.ok(state.event, "the second checkpoint opens automatically after the first resolves");
  assert.strictEqual(state.event.title, "פרויקט גמר");
  assert.strictEqual(state.age, 25, "the commitment advanced to the second checkpoint at year 4");

  assert.strictEqual(game.resolveEvent(0), true, "פרויקט שאפתני");
  state = game.getState();
  assert.ok(state.pathTags.includes("thesis-ambitious"), "the second checkpoint choice is recorded");
  assert.ok(state.pathTags.includes("filmSchool"), "completing the commitment tags the chosen entry path");
  assert.strictEqual(state.assets.diploma, true, "film school grants the diploma asset on completion");
  assert.strictEqual(state.fame, 2, "film school grants fame on completion");
  assert.strictEqual(state.commitment, null, "the commitment clears once complete");
  assert.strictEqual(state.stageId, "student", "the diploma's fame grant alone is not enough to meet the higher milestone bar — the stage stays open for more play");

  // --- fallback path: required milestones never met before the grace deadline ---
  // grace deadline is age 29 (ageRange[1]=26 + STAGE_GRACE_YEARS=3); at 0.4y/gig that's 20 gigs from age 21
  game.newGame();
  for (let i = 0; i < 22; i++) {
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
  game.__testSetState({ cash: 50, bank: 0, bankruptcyStrikes: 3, debt: 100000 });
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
  assert.strictEqual(state.stageId, "indie", "industry's own required milestones (fame>=40, contacts>=18) transition into indie");
  assert.strictEqual(state.bag.crewFavor, undefined, "the gating good is liquidated on transition since indie (still a stub) has no matching good");
  assert.ok(state.log.some((line) => line.indexOf("מומש אוטומטית") === 0));

  // --- indie stage: the full film-production flow (genre -> script -> cast -> shoot -> edit -> distribution -> poster), films.push on completion, milestone transition ---
  game.newGame();
  game.__testJumpToStage("indie");
  assert.strictEqual(game.startCommitment("indieFilm"), true);
  state = game.getState();
  assert.strictEqual(state.event.title, "לבחור ז'אנר", "production opens on a genre pick before any time passes");
  assert.strictEqual(game.resolveEvent(0), true, "דרמה"); // genre-drama: fame+1, filmDraft.genre="דרמה"
  state = game.getState();
  assert.strictEqual(state.fame, 1, "a checkpoint choice's effect() applies immediately, not just its pathTag");
  assert.strictEqual(state.event.title, "התסריט מוכן");
  assert.strictEqual(game.resolveEvent(1), true, "להישאר רזים ויעילים"); // script-lean: fame+1
  state = game.getState();
  assert.strictEqual(state.fame, 2);
  assert.strictEqual(state.event.title, "מי מככב/ת?", "casting is its own real decision, not folded into the shoot checkpoint");
  assert.strictEqual(game.resolveEvent(0), true, "כוכב/ת מוכר/ת"); // cast-star: -2000 cash, fame+2, followers+500, sets filmDraft.starName
  state = game.getState();
  assert.strictEqual(state.fame, 4);
  assert.strictEqual(state.event.title, "הצילומים מסתיימים");
  assert.strictEqual(game.resolveEvent(1), true, "לעצור בתקציב"); // on-budget: cash+500
  state = game.getState();
  assert.strictEqual(state.event.title, "משמרות עריכה", "editing shifts are their own checkpoint after the shoot wraps");
  assert.strictEqual(game.resolveEvent(1), true, "לסגור בגרסה הראשונה"); // edit-rough: no effect
  state = game.getState();
  assert.strictEqual(state.event.title, "בחירת הפצה");
  assert.strictEqual(game.resolveEvent(0), true, "מסלול פסטיבלים"); // festival-track: achievements flag + fame+2
  state = game.getState();
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
  const flightGame = loadGame(path, () => 0.01);
  flightGame.__testJumpToStage("festivals");
  flightGame.__testSetState({ cash: 5000 });
  assert.strictEqual(flightGame.doGig("consultingGig"), true);
  let fstate = flightGame.getState();
  assert.ok(fstate.event, "a flight invite can appear on any year-advancing action once the stage is festivals");
  assert.strictEqual(fstate.event.title.indexOf("הוזמנת לפסטיבל "), 0);
  const cityId = fstate.event.choices[0].cityId;
  assert.strictEqual(cityId, "athens", "the city pick is reproducible under a fixed RNG");
  const beforeFlight = fstate;
  assert.strictEqual(flightGame.resolveEvent(0), true, "accepting the flight");
  fstate = flightGame.getState();
  assert.strictEqual(fstate.achievements["visited-athens"], true, "a visited city is recorded so it won't be offered again");
  assert.ok(fstate.cash < beforeFlight.cash, "the flight fare was charged");
  assert.ok(fstate.fame > beforeFlight.fame, "the trip pays off in reputation");

  // --- full-life win: legacy is the last stage, so meeting its required milestones ends the run in victory ---
  game.newGame();
  game.__testJumpToStage("legacy");
  game.__testSetState({ fame: 95, films: [{ title: "הסרט העצמאי הראשון" }] });
  assert.strictEqual(game.startCommitment("legacyFilm"), true);
  state = game.getState();
  assert.strictEqual(state.event.title, "לבחור ז'אנר", "the capstone film still opens on a genre pick, even in its leaner two-decision flow");
  assert.strictEqual(game.resolveEvent(0), true, "דרמה"); // genre-drama: fame+1 -> 96
  assert.strictEqual(game.resolveEvent(0), true, "הסיפור הכי אישי שלך"); // fame+2 -> 98
  assert.strictEqual(game.resolveEvent(0), true, "הקרנת יחיד בפסטיבל הבית"); // fame+3 -> 101
  state = game.getState();
  assert.strictEqual(state.event.title, "הסרט יוצא לאקרנים", "the capstone film also ends on a poster reveal");
  assert.ok(state.event.html && state.event.html.indexOf("קובי") !== -1, "with no cast checkpoint of its own, the legacy poster credits the player as star");
  assert.strictEqual(game.resolveEvent(0), true, "להמשיך ←"); // poster-ack -> completeCommitment grants +5 -> 106
  state = game.getState();
  assert.strictEqual(state.films.length, 2, "the legacy film is a second real film asset");
  assert.strictEqual(state.films[1].starring, "קובי");
  assert.strictEqual(state.fame, 106, "95 + 1(drama) + 2(personal-story) + 3(solo-screening) + 5(grantsOnComplete) = 106");
  assert.strictEqual(state.ended, true, "meeting legacy's required milestones ends the run — there is no seventh stage");
  assert.strictEqual(state.win, true, "reaching the end of the career ladder is a win, not a timer running out");
  assert.ok(state.final && state.final.score > 0, "a final score is computed on completion");

  // --- RNG-injected price events (crash / spike / unavailable) ---
  const studentGoods = game.STAGES[0].goods;
  const crashState = loadGame(path, () => 0.01).getState();
  assertAllKind(crashState, studentGoods, "crash");
  const spikeState = loadGame(path, () => 0.07).getState();
  assertAllKind(spikeState, studentGoods, "spike");
  const unavailGame = loadGame(path, () => 0.11);
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
  // roll 0.20 lands on bank-call's band when debt>0 (pool: gig-falls-through[0,.08) cheap-gear[.08,.16) bank-call[.16,.26) road-gig[.26,.34)),
  // and on road-gig's shifted band when debt=0 filters bank-call out of the pool entirely
  const bankCallGame = loadGame(path, () => 0.20);
  bankCallGame.startCommitment("selfTaught");
  bankCallGame.doGig("waiter");
  assert.strictEqual(bankCallGame.getState().event.title, "הבנק מתקשר", "the bank still calls about real debt");

  const noDebtCallGame = loadGame(path, () => 0.20);
  noDebtCallGame.startCommitment("selfTaught");
  noDebtCallGame.__testSetState({ debt: 0 });
  noDebtCallGame.doGig("waiter");
  const noDebtState = noDebtCallGame.getState();
  assert.notStrictEqual(noDebtState.event && noDebtState.event.title, "הבנק מתקשר", "the bank has nothing to call about once debt is zero");
  assert.strictEqual(noDebtState.debt, 0, "a zero balance can't be pushed back into debt by a phantom collection call");
}

if (require.main === module) {
  run(process.argv[2] || "studio-mogul-dope-wars.html");
  console.log("test-night-market: ok");
}

module.exports = { run };
