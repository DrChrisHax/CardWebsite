const PokerEvaluator = require("poker-evaluator");

function evaluate(holeCards, communityCards) {
  const result = PokerEvaluator.evalHand([...holeCards, ...communityCards]);
  return {
    value: result.value, // higher = better — use this to compare hands
    handType: result.handType,
    handName: result.handName,
  };
}

module.exports = { evaluate };
