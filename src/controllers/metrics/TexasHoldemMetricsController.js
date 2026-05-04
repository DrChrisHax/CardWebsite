const HandHistory = require("../../models/HandHistory");

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

module.exports = { getBalancePerHand, getNetProfitPerHand, getResultsBreakdown };
