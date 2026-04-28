const GameState = require("../../models/GameState");
const AIPlayer = require("../../models/AIPlayer");
const User = require("../../models/User");

// ============================================================
// AI Players
// ============================================================

async function getAIPlayers(req, res) {
  const { gameId } = req.query;
  if (!gameId) return res.status(400).json({ error: "gameId required" });
  try {
    const players = await AIPlayer.find({ gameId, active: true }).select(
      "playerName model",
    );
    return res.json(players);
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}

// ============================================================
// Game State
// ============================================================

async function getState(req, res) {
  const { gameId } = req.query;
  if (!gameId) return res.status(400).json({ error: "gameId required" });
  try {
    const [gameState, user] = await Promise.all([
      GameState.findOne({ userId: req.userId, gameId, status: "active" }),
      User.findById(req.userId).select("username balance"),
    ]);
    return res.json({
      gameState,
      username: user.username,
      playerChips: user.balance,
    });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}

async function newGame(req, res) {
  const { gameId, aiConfigs } = req.body;

  if (!gameId) return res.status(400).json({ error: "gameId required" });
  if (!Array.isArray(aiConfigs) || aiConfigs.length !== 5) {
    return res.status(400).json({ error: "Exactly 5 aiConfigs required" });
  }

  try {
    const aiIds = aiConfigs.map((c) => c.aiPlayerId);
    const validAIs = await AIPlayer.find({
      _id: { $in: aiIds },
      gameId,
      active: true,
    });
    const aiMap = Object.fromEntries(
      validAIs.map((a) => [a._id.toString(), a]),
    );

    for (const config of aiConfigs) {
      if (!aiMap[config.aiPlayerId]) {
        return res
          .status(400)
          .json({ error: `Invalid AI player: ${config.aiPlayerId}` });
      }
    }

    await GameState.updateOne(
      { userId: req.userId, gameId, status: "active" },
      { status: "completed" },
    );

    const aiSeats = aiConfigs.map((config, i) => ({
      seat: i + 1,
      aiPlayerId: config.aiPlayerId,
      displayName: config.displayName,
      model: aiMap[config.aiPlayerId].model,
      chips: 1000,
    }));

    const [gameState, user] = await Promise.all([
      GameState.create({
        userId: req.userId,
        gameId,
        status: "active",
        dealerSeat: Math.floor(Math.random() * 6),
        handCount: 0,
        aiSeats,
        currentHand: null,
      }),
      User.findById(req.userId).select("username balance"),
    ]);

    return res.status(201).json({
      gameState,
      username: user.username,
      playerChips: user.balance,
    });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = { getAIPlayers, getState, newGame };
