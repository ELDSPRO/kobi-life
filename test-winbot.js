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
  vm.runInContext(script, context);
  return context;
}

function run(htmlPath) {
  const game = loadGame(htmlPath);
  const state = () => game.getState();

  game.startGame({
    playerName: "Winbot",
    economyDifficulty: "modest",
    goalLevels: { wealth: "modest", career: "modest", education: "modest", happiness: "modest" }
  });

  const s = state();
  s.cash = 14000;
  s.education = 2;
  s.educationCredits = 4;
  s.reputation = 26;
  s.experience = 120;
  s.filmUnlocked = true;
  s.equipment.camera = true;
  s.housing = "secure";
  s.wardrobeTier = 3;
  s.wardrobeWear = 100;
  s.soul = 82;
  s.creativity = 84;
  s.love = 79;
  s.city = "paris";
  s.currentBuilding = "script";

  assert.strictEqual(game.openOfferDeck("script"), true, "script deck opens");
  assert.strictEqual(game.buyScript(0), true, "project can be created");
  assert.strictEqual(state().projects.length, 1, "one project created");

  assert.strictEqual(game.openOfferDeck("cast"), true, "cast deck opens");
  assert.strictEqual(game.hire("cast", 0), true, "first cast hire");
  assert.strictEqual(game.openOfferDeck("cast"), true, "cast deck opens again");
  assert.strictEqual(game.hire("cast", 0), true, "second cast hire");

  assert.strictEqual(game.openOfferDeck("crew"), true, "crew deck opens");
  assert.strictEqual(game.hire("crew", 0), true, "crew hire one");
  assert.strictEqual(game.openOfferDeck("crew"), true, "crew deck reopens");
  assert.strictEqual(game.hire("crew", 0), true, "crew hire two");
  assert.strictEqual(game.openOfferDeck("crew"), true, "crew deck reopens again");
  assert.strictEqual(game.hire("crew", 0), true, "crew hire three");

  game.endDay();
  assert.strictEqual(game.doShoot(undefined, "bold"), true, "first shoot");
  game.endDay();
  assert.strictEqual(game.doShoot(undefined, "bold"), true, "second shoot");
  game.endDay();
  assert.strictEqual(game.doPost(), true, "post-production works");
  assert.strictEqual(game.doPremiere(), true, "premiere works");
  assert.strictEqual(game.doCinema(), true, "cinema release works");

  const project = state().projects[0];
  assert.strictEqual(project.released, true, "project becomes released");
  assert.ok(state().weeklyRevenue.length > 0, "cinema release schedules weekly payouts");

  for (let i = 0; i < 50; i += 1) {
    game.endDay();
  }

  assert.ok(state().cash > 9000, "weekly payouts bring cash back");
  assert.ok(state().reputation > 26, "release grows reputation");

  state().cash = 22000;
  // career goal (modest 70) = reputation + released*15 + jobTier*12; with one film
  // and no job, reputation must reach 55 to clear it. 60 represents a strong career.
  state().reputation = 60;
  game.endDay();
  assert.ok(state().winState && state().winState.win === true, "strong deterministic run can trigger the win state");
}

if (require.main === module) {
  const htmlPath = process.argv[2] || "studio-mogul-365.html";
  run(htmlPath);
  console.log("test-winbot: ok");
}

module.exports = { run };
