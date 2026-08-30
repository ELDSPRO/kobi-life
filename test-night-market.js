const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

function loadGame(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const match = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  assert.ok(match, "night market has a playable inline script");
  const context = { console, Math: Object.create(Math), JSON, Intl };
  context.Math.random = () => 0.5;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(match[1], context);
  return context.kobiNightMarket;
}

function run(htmlPath) {
  const game = loadGame(htmlPath);
  assert.strictEqual(typeof game.buy, "function", "buy is playable");
  assert.strictEqual(typeof game.sell, "function", "sell is playable");
  assert.strictEqual(typeof game.travel, "function", "travel is playable");

  const initial = game.getState();
  assert.strictEqual(initial.day, 1, "a run begins on day 1");
  assert.strictEqual(initial.debt, 8000, "a run begins with real debt");
  assert.strictEqual(game.buy("script"), true, "the player can buy a cheap market item");
  assert.strictEqual(game.getState().bag.script, 1, "a bought item enters the bag");
  assert.strictEqual(game.sell("script"), true, "the player can sell an owned item");
  assert.ok(!game.getState().bag.script, "selling removes the item from the bag");

  const beforeFlight = game.getState();
  assert.strictEqual(game.travel("haifa"), true, "the player can fly to another market");
  const afterFlight = game.getState();
  assert.strictEqual(afterFlight.day, 2, "a flight consumes exactly one day");
  assert.ok(afterFlight.debt > beforeFlight.debt, "debt grows every travel turn");
  if (afterFlight.event) game.dismissEvent();

  const beforePay = game.getState();
  assert.strictEqual(game.payDebt(), true, "cash can be used to pay debt");
  assert.ok(game.getState().debt < beforePay.debt, "a debt payment reduces debt");
  game.finish();
  assert.strictEqual(game.getState().ended, true, "a run can end and receive a final score");
}

if (require.main === module) {
  run(process.argv[2] || "studio-mogul-dope-wars.html");
  console.log("test-night-market: ok");
}

module.exports = { run };
