const GameState = require("../../models/GameState");
const AIPlayer = require("../../models/AIPlayer");
const User = require("../../models/User");
const GameManager = require("../../games/texas_holdem/GameManager");
const { MAX_HAND_BET } = require("../../games/texas_holdem/GameManager");
const botRegistry = require("../../games/texas_holdem/botRegistry");

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

    if (!gameState)
      return res.json({
        gameState: null,
        username: user.username,
        playerChips: user.balance,
      });

    const gm = new GameManager(botRegistry);
    return res.json({
      gameState: gm.buildStateResponse(gameState, user),
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

// ============================================================
// Deal (start a new hand)
// ============================================================

async function deal(req, res) {
  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ error: "gameId required" });
  try {
    const [gameState, user] = await Promise.all([
      GameState.findOne({ userId: req.userId, gameId, status: "active" }),
      User.findById(req.userId).select("username balance"),
    ]);

    if (!gameState) return res.status(404).json({ error: "No active game" });
    if (gameState.currentHand) {
      return res.status(400).json({ error: "Hand already in progress" });
    }

    const gm = new GameManager(botRegistry);
    const result = await gm.startHand(gameState, user);
    return res.json(result);
  } catch (err) {
    console.error("deal error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

// ============================================================
// Player Action
// ============================================================

async function playerAction(req, res) {
  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ error: "gameId required" });
  try {
    const [gameState, user] = await Promise.all([
      GameState.findOne({ userId: req.userId, gameId, status: "active" }),
      User.findById(req.userId).select("username balance"),
    ]);

    if (!gameState || !gameState.currentHand) {
      return res.status(400).json({ error: "No hand in progress" });
    }
    if (gameState.currentHand.activeSeat !== 0) {
      return res.status(400).json({ error: "Not your turn" });
    }

    const { action, amount = 0 } = req.body;
    if (!action) return res.status(400).json({ error: "action required" });

    const hand = gameState.currentHand;
    const myBet = hand.seatBets["0"] || 0;
    const toCall = Math.max(0, hand.currentBet - myBet);
    const chips = user.balance;

    // Validate
    let valid = false;
    if (action === "fold") valid = true;
    else if (action === "check") valid = toCall === 0;
    else if (action === "call") valid = toCall > 0 && toCall < chips;
    else if (action === "raise") {
      valid =
        typeof amount === "number" &&
        amount >= hand.lastRaiseAmount &&
        amount <= MAX_HAND_BET &&
        toCall + amount <= chips;
    } else if (action === "all_in") valid = chips > 0;

    if (!valid) return res.status(400).json({ error: "Invalid action" });

    const gm = new GameManager(botRegistry);
    gm.applyAction(hand, 0, { type: action, amount }, gameState, user);

    const actionLog = [{ type: "action", seat: 0, action, amount }];
    const result = await gm.runLoop(gameState, user, actionLog);
    return res.json(result);
  } catch (err) {
    console.error("playerAction error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = { getAIPlayers, getState, newGame, deal, playerAction };
