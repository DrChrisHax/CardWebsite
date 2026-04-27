const Game = require("../models/Game");
const games = require("../data/games.json");

async function populateGames() {
  const count = await Game.countDocuments();
  if (count > 0) return;
  await Game.insertMany(games);
  console.log(`Seeded ${games.length} game(s)`);
}

async function loadStaticData() {
  await populateGames();
}

module.exports = loadStaticData;
