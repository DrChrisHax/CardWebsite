const UserPurchasedGames = require("../../models/UserPurchasedGames");
const GameState = require("../../models/GameState");

async function getGames(req, res) {
  try {
    const purchased = await UserPurchasedGames.find({
      userId: req.userId,
    }).populate("gameId", "gameName path");

    const games = [];
    for (const p of purchased) {
      if (!p.gameId) continue;
      const sessions = await GameState.find({
        userId: req.userId,
        gameId: p.gameId._id,
      })
        .select("_id handCount status createdAt")
        .sort({ createdAt: 1 });

      games.push({
        _id: p.gameId._id,
        gameName: p.gameId.gameName,
        path: p.gameId.path,
        sessions,
      });
    }

    return res.json(games);
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = { getGames };
