const Game = require("../models/Game");
const games = require("../data/games.json");
const AIPlayer = require("../models/AIPlayer");
const aiPlayers = require("../data/aiPlayers.json");

async function populateGames() {
  const count = await Game.countDocuments();
  if (count > 0) return;
  await Game.insertMany(games);
  console.log(`Populated ${games.length} game(s)`);
}

async function populateAIPlayers() {
  const count = await AIPlayer.countDocuments();
  if (count > 0) return;

  const docs = await Promise.all(
    aiPlayers.map(async ({ gameName, ...rest }) => {
      const game = await Game.findOne({ gameName });
      if (!game) throw new Error(`Game not found for AI seed: "${gameName}"`);
      return { ...rest, gameId: game._id };
    }),
  );

  await AIPlayer.insertMany(docs);
  console.log(`Populated ${docs.length} AI Player(s)`);
}

async function loadStaticData() {
  await populateGames();
  await populateAIPlayers();
}

module.exports = loadStaticData;
