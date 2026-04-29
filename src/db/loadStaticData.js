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
  const docs = await Promise.all(
    aiPlayers.map(async ({ gameName, ...rest }) => {
      const game = await Game.findOne({ gameName });
      if (!game) throw new Error(`Game not found for AI seed: "${gameName}"`);
      return { ...rest, gameId: game._id };
    }),
  );

  for (const doc of docs) {
    await AIPlayer.findOneAndUpdate(
      { playerName: doc.playerName, gameId: doc.gameId },
      { $set: doc },
      { upsert: true },
    );
  }
  console.log(`Upserted ${docs.length} AI Player(s)`);
}

async function loadStaticData() {
  await populateGames();
  await populateAIPlayers();
}

module.exports = loadStaticData;
