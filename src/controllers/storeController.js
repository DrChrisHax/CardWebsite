const Game = require("../models/Game");
const UserPurchasedGames = require("../models/UserPurchasedGames");
const User = require("../models/User");

async function getStore(req, res) {
  try {
    const owned = await UserPurchasedGames.find({ userId: req.userId }).select(
      "gameId",
    );
    const ownedIds = owned.map((r) => r.gameId);
    const games = await Game.find({
      active: true,
      _id: { $nin: ownedIds },
    }).select("gameName price path");
    return res.json(games);
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}

async function buyGame(req, res) {
  const { gameId } = req.params;
  try {
    const game = await Game.findOne({ _id: gameId, active: true });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const alreadyOwned = await UserPurchasedGames.exists({
      userId: req.userId,
      gameId,
    });
    if (alreadyOwned)
      return res.status(409).json({ error: "Game already owned" });

    const user = await User.findById(req.userId);
    if (user.balance < game.price)
      return res.status(400).json({ error: "Insufficient balance" });

    await UserPurchasedGames.create({ userId: req.userId, gameId });
    user.balance -= game.price;
    await user.save();

    return res.json({ balance: user.balance });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}

async function getMyGames(req, res) {
  try {
    const purchased = await UserPurchasedGames.find({
      userId: req.userId,
    }).populate("gameId", "gameName path");
    const games = purchased.map((p) => p.gameId).filter(Boolean);
    return res.json(games);
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = { getStore, buyGame, getMyGames };
