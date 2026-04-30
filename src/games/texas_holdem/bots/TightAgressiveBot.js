// ============================================================
// Tight Aggressive Bot Strategy
// ============================================================
// Plays a narrow range of strong hands but bets and raises big
// when it does play. Folds most hands pre-flop, never limps.
//
// Pre-Flop:
//   Requires a Chen score of 9 or higher to play. On the button,
//   loosens slightly and plays 7 or higher. When it enters a pot
//   it always raises, never calls. Folds everything below its
//   threshold without hesitation.
//
// Post-Flop:
//   Only continues with strong made hands. No bluff bonus.
//   The final score determines the action:
//     - Below 0.40 with a cost to stay in: fold
//     - Below 0.60: check or call
//     - 0.60 or above: raise (size = score * pot * 1.5, capped at max bet)
// ============================================================

const PokerEngine = require("./PokerEngine");
const { calculateChenScore, normalizeHandStrength, discountForOpponents, calculateRaiseAmount } = require("./BotUtils");
const { Action, ActionType } = require("../Action");
const { Street, Position } = require("../THGameState");
const { MAX_HAND_BET } = require("../GameManager");

const FOLD_THRESHOLD = 0.40;
const RAISE_THRESHOLD = 0.60;
const AGGRESSION_MULTIPLIER = 1.5;

class TightAgressiveBot extends PokerEngine {
  decide(state) {
    if (state.street === Street.PREFLOP) {
      return this._decidePreflop(state);
    }
    return this._decidePostFlop(state);
  }

  _decidePreflop(state) {
    const { chipsToCall, bigBlind, streetRaises, stack, position } = state;
    const chenScore = calculateChenScore(state);
    const chenThreshold = position === Position.BTN ? 7 : 9;

    if (chenScore < chenThreshold) {
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
    if (stack <= chipsToCall + raiseAmount) return new Action(ActionType.ALL_IN);
    return new Action(ActionType.RAISE, raiseAmount);
  }

  _decidePostFlop(state) {
    const { chipsToCall, stack, pot, activePlayers } = state;
    const strength = normalizeHandStrength(state);
    const effectiveScore = discountForOpponents(strength, activePlayers);

    if (effectiveScore < FOLD_THRESHOLD && chipsToCall > 0) {
      return new Action(ActionType.FOLD);
    }

    if (effectiveScore >= RAISE_THRESHOLD) {
      const raiseAmount = calculateRaiseAmount(effectiveScore, pot, AGGRESSION_MULTIPLIER, MAX_HAND_BET);
      if (stack <= chipsToCall) return new Action(ActionType.ALL_IN);
      if (stack <= chipsToCall + raiseAmount) return new Action(ActionType.ALL_IN);
      return new Action(ActionType.RAISE, raiseAmount);
    }

    if (chipsToCall === 0) return new Action(ActionType.CHECK);
    if (chipsToCall >= stack) return new Action(ActionType.ALL_IN);
    return new Action(ActionType.CALL);
  }
}

module.exports = TightAgressiveBot;
