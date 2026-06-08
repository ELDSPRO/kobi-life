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
  const dataPath = path.join(path.dirname(htmlPath), "data.js");
  vm.runInContext(fs.readFileSync(dataPath, "utf8"), context);
  vm.runInContext(script, context);
  return context;
}

function run(htmlPath) {
  const game = loadGame(htmlPath);
  const state = () => game.getState();

  game.startGame({
    playerName: "ModTester",
    economyDifficulty: "modest",
    goalLevels: { wealth: "modest", career: "modest", education: "modest", happiness: "modest" }
  });

  // Fresh state has no active modifiers.
  assert.ok(Array.isArray(state().activeModifiers), "activeModifiers is an array");
  assert.strictEqual(state().activeModifiers.length, 0, "starts with no active modifiers");

  // --- Gear discount path ---
  // Buy a camera at full price as the baseline.
  state().cash = 5000;
  state().experience = 80;
  state().wardrobeTier = 1;
  state().education = 1;
  const cashBeforeFull = state().cash;
  assert.strictEqual(game.buyEquip("camera"), true, "can buy camera at full price");
  const fullCost = cashBeforeFull - state().cash;
  assert.ok(fullCost > 1000, "camera should cost real money (~1700)");

  // Reset camera ownership and apply a gear discount modifier.
  state().equipment.camera = false;
  state().activeModifiers.push({
    id: "gear_sale:test",
    briefingId: "gear_sale",
    category: "gear",
    value: 0.75,
    daysLeft: 3,
    label: { he: "מבצע", en: "Sale" }
  });
  state().cash = 5000;
  const cashBeforeSale = state().cash;
  assert.strictEqual(game.buyEquip("camera"), true, "can buy camera during sale");
  const saleCost = cashBeforeSale - state().cash;
  assert.ok(saleCost < fullCost, "sale cost is lower than full price (" + saleCost + " < " + fullCost + ")");
  const ratio = saleCost / fullCost;
  assert.ok(ratio > 0.70 && ratio < 0.80, "discount is roughly 25% (ratio=" + ratio.toFixed(3) + ")");

  // --- Modifier expiry: advance days; modifier should drop off ---
  // Pre-load a modifier with 2 days left, then run endDay twice.
  state().activeModifiers = [{
    id: "gear_sale:test2",
    briefingId: "gear_sale",
    category: "gear",
    value: 0.5,
    daysLeft: 2,
    label: { he: "מבצע", en: "Sale" }
  }];
  game.endDay();
  assert.strictEqual(state().activeModifiers.length, 1, "modifier still active after 1 day");
  assert.strictEqual(state().activeModifiers[0].daysLeft, 1, "daysLeft decremented");
  game.endDay();
  assert.strictEqual(state().activeModifiers.length, 0, "modifier expired after 2 days");

  // --- Course credit bonus ---
  state().activeModifiers = [{
    id: "masterclass:test",
    briefingId: "masterclass",
    category: "courseCredits",
    value: 1.5,
    daysLeft: 2,
    label: { he: "סדנה", en: "Masterclass" }
  }];
  state().cash = 3000;
  const eduCreditsBefore = state().educationCredits;
  assert.strictEqual(game.attendClass("weekend"), true, "can attend class with bonus");
  const creditsGained = state().educationCredits - eduCreditsBefore;
  // weekend course gives 1 credit * paceScale * 1.5; paceScale = sqrt(365/seasonLength).
  // For default seasonLength 365, paceScale = 1, so we expect ~1.5 credits gained
  // (or higher if an education level-up consumed some — but +1 credit at min from bonus).
  assert.ok(creditsGained > 1.0, "course credits gained reflect the 1.5x bonus (got " + creditsGained + ")");

  // --- Same-category replace: a new gear modifier should evict the old one ---
  state().activeModifiers = [{
    id: "old_gear", briefingId: "gear_up", category: "gear", value: 1.25, daysLeft: 3,
    label: { he: "x", en: "x" }
  }];
  // Simulate the engine applying a new gear briefing via the same path the
  // production code uses. We poke applyBriefingModifier through a tiny trick:
  // trigger a real daily briefing by running endDay, which will pick from the
  // pool. To keep this deterministic, we just verify the structural rule by
  // re-running the helper indirectly via successive endDay calls. The minimum
  // contract: at no point should two gear-category modifiers coexist.
  for (let i = 0; i < 10; i += 1) {
    game.endDay();
    const gearCount = state().activeModifiers.filter((m) => m.category === "gear").length;
    assert.ok(gearCount <= 1, "no more than one gear modifier at any time (day " + state().day + ")");
  }
}

if (require.main === module) {
  const htmlPath = process.argv[2] || "studio-mogul-365.html";
  run(htmlPath);
  console.log("test-modifiers: ok");
}

module.exports = { run };
