const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

function loadGame(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const match = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  assert.ok(match, "the game has a playable inline script");
  const context = { console, Math: Object.create(Math), JSON, Intl };
  context.Math.random = () => 0.5;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(match[1], context);
  return context.kobiFilmTrader;
}

function clearEvent(game) {
  const state = game.getState();
  if (state.event) game.resolveEvent(state.event.choices.length - 1);
}

function run(htmlPath) {
  const game = loadGame(htmlPath);
  assert.strictEqual(typeof game.travel, "function", "the map travel loop is playable");
  assert.strictEqual(typeof game.openService, "function", "each city service opens separately");
  assert.strictEqual(typeof game.requestFunding, "function", "funding is a separate playable service");

  let state = game.getState();
  assert.strictEqual(state.view, "map", "a new run begins on the travel map");
  assert.strictEqual(state.debt, 8000, "a new run begins with real debt pressure");
  assert.strictEqual(Object.keys(game.GOALS).length, 4, "the win model tracks money, credits, audience and contacts");

  assert.strictEqual(game.travel("haifa"), true, "the player can fly to another city");
  state = game.getState();
  assert.strictEqual(state.city, "haifa", "travel changes the city");
  assert.strictEqual(state.view, "city", "arrival opens the simple city menu");
  assert.strictEqual(state.week, 2, "a flight consumes one week");
  assert.ok(state.debt > 8000, "debt grows when a week passes");
  clearEvent(game);

  assert.strictEqual(game.openService("work"), true, "work is a dedicated screen");
  const beforeGig = game.getState();
  assert.strictEqual(game.doGig("runner"), true, "a starter gig is playable without equipment");
  state = game.getState();
  assert.ok(state.cash > beforeGig.cash, "work earns cash");
  assert.ok(state.contacts > beforeGig.contacts, "work builds industry contacts");

  game.newGame();
  game.openService("shop");
  ["script", "set", "camera", "sound", "edit"].forEach((id) => {
    assert.strictEqual(game.buy(id), true, id + " can be bought in the shop");
  });
  assert.strictEqual(game.openService("create"), true, "creation is a dedicated screen");
  assert.strictEqual(game.hire("writer"), true, "a writer can build the story layer");
  assert.strictEqual(game.hire("dop"), true, "a cinematographer can build the shooting layer");
  assert.strictEqual(game.hire("editor"), true, "an editor can build the post-production layer");
  assert.strictEqual(game.shootFilm(), true, "a staffed project with gear can be filmed");
  assert.strictEqual(game.finishFilm(), true, "a shot project with an editor can become a finished film");
  state = game.getState();
  assert.strictEqual(state.films.length, 1, "finishing records a real film asset");
  assert.ok(state.films[0].quality >= 15, "a complete crew and technical package creates festival-level quality");

  assert.strictEqual(game.openService("release"), true, "distribution is a dedicated screen");
  const beforeRelease = game.getState();
  assert.strictEqual(game.release("local"), true, "a finished film can earn through local distribution");
  assert.ok(game.getState().cash > beforeRelease.cash, "distribution monetizes a finished film");

  game.newGame();
  ["script", "set", "camera", "sound", "edit"].forEach((id) => game.buy(id));
  assert.strictEqual(game.doGig("camera-assist"), true, "a camera gig can build the credits needed for funding");
  assert.strictEqual(game.hire("writer"), true, "the funding path starts from a written project");
  assert.strictEqual(game.requestFunding("short"), true, "a written project with credits can apply for a grant");
  clearEvent(game);
  assert.strictEqual(game.hire("dop"), true, "grant money keeps the production moving");
  assert.strictEqual(game.hire("editor"), true, "the crew can be completed after funding");
  assert.strictEqual(game.shootFilm(), true, "the funded project can be filmed");
  assert.strictEqual(game.finishFilm(), true, "the funded project can be finished");
  assert.strictEqual(game.travel("athens"), true, "a completed quality film unlocks the festival flight path");
  clearEvent(game);
  assert.strictEqual(game.release("festival"), true, "a festival-ready film can be submitted from Athens");
  assert.strictEqual(game.getState().achievements.festival, true, "festival success completes a non-financial career goal");

  game.newGame();
  const beforeDebtPayment = game.getState();
  assert.strictEqual(game.bank("pay"), true, "the bank can reduce debt");
  assert.ok(game.getState().debt < beforeDebtPayment.debt, "bank payment lowers debt");
  game.finish();
  assert.strictEqual(game.getState().ended, true, "a run can always be concluded");
}

if (require.main === module) {
  run(process.argv[2] || "studio-mogul-dope-wars.html");
  console.log("test-night-market: ok");
}

module.exports = { run };
