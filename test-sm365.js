const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

function loadGame(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (!matches.length) {
    throw new Error("No inline script found");
  }
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
      if (typeof fn === "function") {
        fn();
      }
      return 0;
    },
    clearTimeout() {},
    Date,
    Math,
    JSON
  };
  context.globalThis = context;
  vm.createContext(context);
  const dataPath = require("path").join(require("path").dirname(htmlPath), "data.js");
  if (fs.existsSync(dataPath)) {
    vm.runInContext(fs.readFileSync(dataPath, "utf8"), context);
  }
  vm.runInContext(script, context);
  return context;
}

function run(htmlPath) {
  const game = loadGame(htmlPath);
  const state = () => game.getState();

  [
    "startGame",
    "buyScript",
    "hire",
    "doShoot",
    "doPost",
    "doPremiere",
    "doCinema",
    "doTv",
    "doFund",
    "doPinv",
    "haggle",
    "goToBuilding",
    "flyTo",
    "lifeFlyTo",
    "endDay",
    "bankDo",
    "buyEquip",
    "makeLifeDecision",
    "resolveLifeMonthlyEvent",
    "chooseLifeCareer"
  ].forEach((fnName) => assert.strictEqual(typeof game[fnName], "function", fnName + " should exist"));
  assert.strictEqual(game.LIFE_MONTHLY_EVENTS.length, 50, "life mode has 50 road events");

  game.startGame({
    playerName: "Tester",
    economyDifficulty: "modest",
    goalLevels: { wealth: "modest", career: "modest", education: "modest", happiness: "modest" }
  });

  assert.strictEqual(state().cash, 300, "starts with $300");
  assert.strictEqual(state().housing, "couch", "starts on couch");
  assert.strictEqual(game.applyJob("popcorn"), false, "cannot get hired without clothes");

  assert.strictEqual(game.buyWardrobe(1), true, "can buy first wardrobe tier");
  assert.strictEqual(state().wardrobeTier, 1, "wardrobe tier upgrades");

  assert.strictEqual(game.applyJob("popcorn"), true, "can get first job after wardrobe");
  assert.strictEqual(state().jobId, "popcorn", "job id stored");

  assert.strictEqual(game.workShift(8), true, "can work an 8h shift");
  assert.ok(state().experience >= 8, "shift gives experience");
  assert.ok(state().cash > 150, "shift pays cash");

  assert.strictEqual(game.bankDo("borrow", 3000), true, "can borrow startup money");
  assert.strictEqual(game.switchHousing("cheap"), true, "can rent the cheap flat");
  assert.strictEqual(state().housing, "cheap", "housing updated");

  assert.strictEqual(game.attendClass("weekend"), true, "can take a study course");
  assert.ok(state().education >= 1, "course upgrades education");

  state().experience = 80;
  assert.strictEqual(game.buyEquip("camera"), true, "can buy the first camera");
  assert.strictEqual(state().equipment.camera, true, "camera stored");
  assert.strictEqual(state().filmUnlocked, true, "film loop unlocks once milestones are met");

  assert.strictEqual(game.bankDo("borrow", 2000), true, "can bridge into the first project with debt");
  game.endDay();
  assert.strictEqual(game.openOfferDeck("script"), true, "can open script market offers");
  assert.strictEqual(state().offers.length, 3, "script market creates offers");
  assert.strictEqual(game.buyScript(0), true, "can buy a script");
  assert.strictEqual(state().projects.length, 1, "script creates a project");

  assert.strictEqual(state().day, 2, "ending day advances the calendar");

  game.startGame({
    playerName: "Monthly Tester",
    economyDifficulty: "modest",
    goalLevels: { wealth: "modest", career: "modest", education: "modest", happiness: "modest" }
  });
  assert.strictEqual(state().life.month, 1, "life mode starts in January");
  assert.strictEqual(game.makeLifeDecision("work", "first-job"), true, "monthly choice resolves");
  assert.strictEqual(state().life.month, 2, "monthly choice advances the calendar by one month");
  assert.strictEqual(state().life.timeWeeks, 4, "a completed month refreshes four weeks");
  assert.strictEqual(state().debt, 8080, "end of month applies visible 1% debt interest");
  const surprise = state().life.monthlyEvent;
  assert.ok(surprise, "February opens a surprise task");
  const noTimeCostChoice = surprise.choices.find((choice) => !choice.weeks) || surprise.choices[0];
  assert.strictEqual(game.resolveLifeMonthlyEvent(surprise.id, noTimeCostChoice.id), true, "surprise task choice resolves");
  assert.strictEqual(state().life.month, 2, "surprise task does not consume another month");
  assert.strictEqual(state().life.monthlyEvent, null, "resolved surprise task closes");

  state().experience = 17;
  assert.strictEqual(game.makeLifeDecision("work", "anchor-shift"), true, "a later monthly choice resolves");
  assert.ok(state().life.completedMissionIds.includes("first-credit"), "reaching a route mission records it exactly once");

  game.startGame({
    playerName: "Career Tester",
    economyDifficulty: "modest",
    goalLevels: { wealth: "modest", career: "modest", education: "modest", happiness: "modest" }
  });
  assert.strictEqual(state().life.careerChoicePending, true, "a new life run opens the career choice");
  assert.strictEqual(game.chooseLifeCareer("youtube"), true, "a career route can be chosen once");
  assert.strictEqual(state().life.careerTrack, "youtube", "career track persists on the life run");
  assert.strictEqual(state().life.contacts["dana-creator"], 1, "a career starts with one named industry contact");
  assert.strictEqual(state().followers, 25, "YouTube begins with a small starter audience");
  assert.strictEqual(game.makeLifeDecision("create", "youtube-phone-series"), true, "career-specific monthly action resolves");
  assert.strictEqual(state().followers, 205, "career-specific action changes followers");
  assert.strictEqual(state().life.month, 1, "a one-week action keeps the current month open");
  assert.strictEqual(state().life.timeWeeks, 3, "a one-week action leaves three weeks for more choices");
  assert.strictEqual(game.lifeFlyTo("athens"), true, "a flight can consume one visible week in life mode");
  assert.strictEqual(state().city, "athens", "flight moves the player to the destination city");
  assert.strictEqual(state().life.timeWeeks, 2, "flight consumes one week without ending the month");

  game.startGame({
    playerName: "Study Tester",
    economyDifficulty: "modest",
    goalLevels: { wealth: "modest", career: "modest", education: "modest", happiness: "modest" }
  });
  assert.strictEqual(game.chooseLifeCareer("acting"), true, "acting route can be selected");
  assert.strictEqual(game.makeLifeDecision("create", "career-study-acting"), true, "study month resolves");
  assert.strictEqual(state().life.studyCredits, 1, "study month records a program credit");
  assert.ok(state().life.programStartedAt, "study month records when the long program started");

  game.startGame({
    playerName: "Event Time Tester",
    economyDifficulty: "modest",
    goalLevels: { wealth: "modest", career: "modest", education: "modest", happiness: "modest" }
  });
  state().life.monthlyEvent = {
    id: "test-time-cost",
    title: { he: "בדיקת זמן", en: "Time test" },
    copy: { he: "אירוע בדיקה", en: "Test event" },
    choices: [{ id: "take-week", title: { he: "לקחת שבוע", en: "Take a week" }, copy: { he: "הזמן נצרך", en: "Time is spent" }, effects: { creativity: 1 }, weeks: 1, contact: "naama-producer", contactTrust: 2 }]
  };
  assert.strictEqual(game.resolveLifeMonthlyEvent("test-time-cost", "take-week"), true, "a time-cost surprise resolves");
  assert.strictEqual(state().life.timeWeeks, 3, "a time-cost surprise consumes one visible week");
  assert.strictEqual(state().life.contacts["naama-producer"], 2, "a road event can build trust with a named contact");

  game.startGame({
    playerName: "Pivot Tester",
    economyDifficulty: "modest",
    goalLevels: { wealth: "modest", career: "modest", education: "modest", happiness: "modest" }
  });
  assert.strictEqual(game.chooseLifeCareer("acting"), true, "a first career can be selected before a pivot");
  state().life.age = 30;
  state().life.careerPivotPending = true;
  state().life.studyCredits = 7;
  state().life.programStartedAt = { year: 2026, month: 1 };
  assert.strictEqual(game.chooseLifeCareer("acting"), false, "a career pivot cannot select the current route");
  assert.strictEqual(game.chooseLifeCareer("writing"), true, "age 30 can change the primary career route");
  assert.strictEqual(state().life.careerTrack, "writing", "the pivot persists as the new career route");
  assert.strictEqual(state().life.careerPivotUsed, true, "a career pivot is a one-time decision");
  assert.strictEqual(state().life.careerPivotPending, false, "the pending pivot closes after choosing a new route");
  assert.strictEqual(state().life.studyCredits, 0, "a changed career begins its own study programme");

  game.startGame({
    playerName: "Contact Tester",
    economyDifficulty: "modest",
    goalLevels: { wealth: "modest", career: "modest", education: "modest", happiness: "modest" }
  });
  assert.strictEqual(game.chooseLifeCareer("writing"), true, "writing route is available for contact actions");
  state().life.contacts["ruth-writer"] = 2;
  state().currentBuilding = "script";
  assert.strictEqual(game.makeLifeDecision("create", "contact-ruth-page"), true, "two trust points unlock a location-specific contact action");
  assert.strictEqual(state().life.contacts["ruth-writer"], 3, "taking a contact action strengthens the relationship");
}

if (require.main === module) {
  const htmlPath = process.argv[2] || "studio-mogul-365.html";
  run(htmlPath);
  console.log("test-sm365: ok");
}

module.exports = { run };
