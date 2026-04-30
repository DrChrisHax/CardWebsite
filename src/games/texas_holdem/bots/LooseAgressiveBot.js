// ============================================================
// Loose Aggressive Bot Strategy
// ============================================================
// Plays a wide range of hands and bets aggressively throughout.
// Bluffs often and raises big, even with weak holdings.
//
// Pre-Flop:
//   Uses the Chen formula to score hole cards. Any hand scoring
//   5 or higher is played. With a playable hand, opens 3x BB or
//   re-raises 8x BB if someone has already raised. After two
//   raises it just calls. Weak hands (score <= 4) are folded
//   unless it is free to stay in.
//
// Post-Flop:
//   Hand strength is normalized 0-1 by hand category and then
//   discounted by the number of active players. A random bluff
//   bonus of 0-0.25 is added to simulate loose aggressive play.
//   The final score determines the action:
//     - Below 0.10 with a cost to stay in: fold
//     - Below 0.30: check or call
//     - 0.30 or above: raise (size = score * pot * 1.5, capped at max bet)
// ============================================================

const PokerEngine = require("./PokerEngine");
const {
  calculateChenScore,
  normalizeHandStrength,
  discountForOpponents,
  calculateRaiseAmount,
} = require("./BotUtils");
const { Action, ActionType } = require("../Action");
const { Street } = require("../THGameState");
const { MAX_HAND_BET } = require("../GameManager");

const FOLD_THRESHOLD = 0.1;
const RAISE_THRESHOLD = 0.3;
const AGGRESSION_MULTIPLIER = 1.5;
const BLUFF_MAX = 0.25;

class LooseAgressiveBot extends PokerEngine {
  decide(state) {
    if (state.street === Street.PREFLOP) {
      return this._decidePreflop(state);
    }
    return this._decidePostFlop(state);
  }

  _decidePreflop(state) {
    const { chipsToCall, bigBlind, streetRaises, stack } = state;
    const chenScore = calculateChenScore(state);

    if (chenScore <= 4) {
      if (chipsToCall === 0) return new Action(ActionType.CHECK);
      return new Action(ActionType.FOLD);
    }

    if (streetRaises >= 2) {
      if (chipsToCall === 0) return new Action(ActionType.CHECK);
      if (chipsToCall >= stack) return new Action(ActionType.ALL_IN);
      return new Action(ActionType.CALL);
    }

    const raiseAmount = streetRaises === 0 ? 3 * bigBlind : 8 * bigBlind;

    if (stack <= chipsToCall) return new Action(ActionType.ALL_IN);
    if (stack <= chipsToCall + raiseAmount)
      return new Action(ActionType.ALL_IN);
    return new Action(ActionType.RAISE, raiseAmount);
  }

  _decidePostFlop(state) {
    const { chipsToCall, stack, pot, activePlayers, maxBet } = state;
    const strength = normalizeHandStrength(state);
    const equity = discountForOpponents(strength, activePlayers);
    const effectiveScore = equity + Math.random() * BLUFF_MAX;

    if (effectiveScore < FOLD_THRESHOLD && chipsToCall > 0) {
      return new Action(ActionType.FOLD);
    }

    if (effectiveScore >= RAISE_THRESHOLD) {
      const raiseAmount = calculateRaiseAmount(
        effectiveScore,
        pot,
        AGGRESSION_MULTIPLIER,
        MAX_HAND_BET,
      );
      if (stack <= chipsToCall) return new Action(ActionType.ALL_IN);
      if (stack <= chipsToCall + raiseAmount)
        return new Action(ActionType.ALL_IN);
      return new Action(ActionType.RAISE, raiseAmount);
    }

    if (chipsToCall === 0) return new Action(ActionType.CHECK);
    if (chipsToCall >= stack) return new Action(ActionType.ALL_IN);
    return new Action(ActionType.CALL);
  }
}

module.exports = LooseAgressiveBot;
