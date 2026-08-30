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
  assert.strictEqual(game.resolveLifeMonthlyEvent(surprise.id, surprise.choices[0].id), true, "surprise task choice resolves");
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
}

if (require.main === module) {
  const htmlPath = process.argv[2] || "studio-mogul-365.html";
  run(htmlPath);
  console.log("test-sm365: ok");
}

module.exports = { run };
