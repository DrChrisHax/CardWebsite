// ============================================================
// Card Helpers
// ============================================================

const RANK_INDEX = {
  2: 0,
  3: 1,
  4: 2,
  5: 3,
  6: 4,
  7: 5,
  8: 6,
  9: 7,
  T: 8,
  J: 9,
  Q: 10,
  K: 11,
  A: 12,
};

function _isPair(card1, card2) {
  return card1[0] === card2[0];
}

function _isSuited(card1, card2) {
  return card1[1] === card2[1];
}

function _gapSize(card1, card2) {
  let rank1 = RANK_INDEX[card1[0]];
  let rank2 = RANK_INDEX[card2[0]];

  return Math.abs(rank1 - rank2) - 1;
}

// ============================================================
// Post-Flop Helpers
// ============================================================

const { evaluate } = require("../HandEvaluator");

// Returns hand strength as a value 0-1 based on hand category (high card=0, straight flush=1)
function normalizeHandStrength(state) {
  const result = evaluate(state.holeCards, state.communityCards);
  return result.handType / 8;
}

// Discounts strength based on number of opponents still in the hand
function discountForOpponents(strength, activePlayers) {
  return Math.pow(strength, Math.max(activePlayers - 1, 1));
}

// Returns a raise amount scaled to pot size and hand strength, capped at maxBet
function calculateRaiseAmount(effectiveScore, pot, aggressionMultiplier, maxBet) {
  return Math.min(Math.ceil(effectiveScore * pot * aggressionMultiplier), maxBet);
}

// ============================================================
// Utils
// ============================================================

const RANK_SCORE = {
  A: 10,
  K: 8,
  Q: 7,
  J: 6,
  T: 5,
  9: 4.5,
  8: 4,
  7: 3.5,
  6: 3,
  5: 2.5,
  4: 2,
  3: 1.5,
  2: 1,
};

function calculateChenScore(state) {
  // A = 10
  // K = 8
  // Q = 7
  // J = 6
  // Num = half of value

  // 1. Get the score of the higher card
  // 2. If it is a pair, return 2 times the value. The score must be at least 5
  // 3. If the cards are the same suit, add 2
  // 4. Subtract points if there is a gap between the cards
  //    0 for no gap
  //    -1 for a gap of 1
  //    -2 for a gap of 2
  //    -4 for a gap of 3
  //    -5 for a gap of 4
  // 5. Add 1 point if the higher card is Q or lower and there is a gap of 0 or 1
  // 6. Round up to the nearest int

  const [card1, card2] = state.holeCards;
  const higher = RANK_INDEX[card1[0]] >= RANK_INDEX[card2[0]] ? card1 : card2;
  const lower = higher === card1 ? card2 : card1;
  let score = RANK_SCORE[higher[0]];

  if (_isPair(card1, card2)) {
    return Math.max(score * 2, 5);
  }

  if (_isSuited(card1, card2)) {
    score += 2;
  }

  const gap = _gapSize(card1, card2);

  switch (gap) {
    case 0:
      break;
    case 1:
      score -= 1;
      break;
    case 2:
      score -= 2;
      break;
    case 3:
      score -= 4;
      break;
    default:
      score -= 5;
      break;
  }

  if (RANK_INDEX[higher[0]] <= RANK_INDEX["Q"] && gap <= 1) {
    score += 1;
  }

  return Math.ceil(score);
}

module.exports = { calculateChenScore, normalizeHandStrength, discountForOpponents, calculateRaiseAmount };
