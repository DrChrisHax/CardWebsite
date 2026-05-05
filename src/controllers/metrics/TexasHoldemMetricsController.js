const HandHistory = require("../../models/HandHistory");
const GameState = require("../../models/GameState");


function buildSessionBoundaries(hands) {
  const boundaries = [];
  let lastSessionId = null;
  hands.forEach((h, i) => {
    const sid = String(h.gameStateId);
    if (lastSessionId !== null && sid !== lastSessionId) boundaries.push(i);
    lastSessionId = sid;
  });
  return boundaries;
}

async function getBalancePerHand(req, res) {
  const { gameId, gameStateId } = req.query;
  if (!gameId) return res.status(400).json({ error: "gameId required" });

  try {
    const query = { userId: req.userId, gameId };
    if (gameStateId && gameStateId !== "all") query.gameStateId = gameStateId;

    const hands = await HandHistory.find(query)
      .select("handNumber balanceAfter gameStateId")
      .sort({ handNumber: 1 });

    const sessionBoundaries = buildSessionBoundaries(hands);
    const data = hands.map((h, i) => ({ hand: i + 1, balance: h.balanceAfter }));

    return res.json({ hands: data, sessionBoundaries });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}

async function getNetProfitPerHand(req, res) {
  const { gameId, gameStateId } = req.query;
  if (!gameId) return res.status(400).json({ error: "gameId required" });

  try {
    const query = { userId: req.userId, gameId };
    if (gameStateId && gameStateId !== "all") query.gameStateId = gameStateId;

    const hands = await HandHistory.find(query)
      .select("handNumber amountBet amountWon gameStateId")
      .sort({ handNumber: 1 });

    const sessionBoundaries = buildSessionBoundaries(hands);
    const data = hands.map((h, i) => ({
      hand: i + 1,
      netChange: h.amountWon - h.amountBet,
    }));

    return res.json({ hands: data, sessionBoundaries });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}

async function getResultsBreakdown(req, res) {
  const { gameId, gameStateId } = req.query;
  if (!gameId) return res.status(400).json({ error: "gameId required" });

  try {
    const query = { userId: req.userId, gameId };
    if (gameStateId && gameStateId !== "all") query.gameStateId = gameStateId;

    const hands = await HandHistory.find(query).select("result");

    const counts = { win: 0, loss: 0, fold: 0, split: 0 };
    hands.forEach((h) => {
      if (counts[h.result] !== undefined) counts[h.result]++;
    });

    return res.json(counts);
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}

async function getHandRecords(req, res) {
  const { gameId, gameStateId, type } = req.query;
  if (!gameId) return res.status(400).json({ error: "gameId required" });
  if (type !== "wins" && type !== "losses") {
    return res.status(400).json({ error: "type must be 'wins' or 'losses'" });
  }

  try {
    const resultFilter =
      type === "wins" ? { $in: ["win", "split"] } : { $in: ["loss", "fold"] };

    const query = { userId: req.userId, gameId, result: resultFilter };
    if (gameStateId && gameStateId !== "all") query.gameStateId = gameStateId;
    if (type === "wins") {
      query.$expr = { $gt: [{ $subtract: ["$amountWon", "$amountBet"] }, 3] };
    } else if (type === "losses") {
      query.$expr = { $gt: [{ $subtract: ["$amountBet", "$amountWon"] }, 2] };
    }

    const [sessions, hands] = await Promise.all([
      GameState.find({ userId: req.userId, gameId })
        .select("_id")
        .sort({ createdAt: 1 }),
      HandHistory.find(query).select(
        "handNumber amountBet amountWon winningHandType gameStateId"
      ),
    ]);

    const sessionMap = {};
    sessions.forEach((s, i) => {
      sessionMap[s._id.toString()] = i + 1;
    });

    const records = hands.map((h) => ({
      sessionNumber: sessionMap[h.gameStateId.toString()] || 0,
      handNumber: h.handNumber,
      netChange: h.amountWon - h.amountBet,
      winningHandType: h.winningHandType || null,
    }));

    return res.json(records);
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = {
  getBalancePerHand,
  getNetProfitPerHand,
  getResultsBreakdown,
  getHandRecords,
};
