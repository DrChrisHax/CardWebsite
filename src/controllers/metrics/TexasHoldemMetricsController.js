const HandHistory = require("../../models/HandHistory");

async function getBalancePerHand(req, res) {
  const { gameId, gameStateId } = req.query;
  if (!gameId) return res.status(400).json({ error: "gameId required" });

  try {
    const query = { userId: req.userId, gameId };
    if (gameStateId && gameStateId !== "all") {
      query.gameStateId = gameStateId;
    }

    const hands = await HandHistory.find(query)
      .select("handNumber balanceAfter gameStateId")
      .sort({ handNumber: 1 });

    // Find indices where the session changes (for boundary markers on the chart)
    const sessionBoundaries = [];
    let lastSessionId = null;
    hands.forEach((h, i) => {
      const sid = String(h.gameStateId);
      if (lastSessionId !== null && sid !== lastSessionId) {
        sessionBoundaries.push(i);
      }
      lastSessionId = sid;
    });

    const data = hands.map((h, i) => ({
      hand: i + 1,
      balance: h.balanceAfter,
    }));

    return res.json({ hands: data, sessionBoundaries });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = { getBalancePerHand };
