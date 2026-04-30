// ============================================================
// Loose Passive Bot Strategy
// ============================================================
// Plays a wide range of hands but rarely raises. Prefers to
// limp in and call down, chasing draws and hoping to get lucky.
//
// Pre-Flop:
//   Plays any hand with a Chen score of 5 or higher. Uses the
//   same raise logic as the other bots when it does decide to
//   play. Folds weak hands unless it is free to stay in.
//
// Post-Flop:
//   Calls with most hands, rarely raises even with strong holdings.
//   A small bluff bonus (0-0.10) reflects occasional loose play.
//   The final score determines the action:
//     - Below 0.10 with a cost to stay in: fold
//     - Below 0.70: check or call
//     - 0.70 or above: raise (size = score * pot * 0.5, capped at max bet)
// ============================================================

const PokerEngine = require("./PokerEngine");
const { calculateChenScore, normalizeHandStrength, discountForOpponents, calculateRaiseAmount } = require("./BotUtils");
const { Action, ActionType } = require("../Action");
const { Street } = require("../THGameState");
const { MAX_HAND_BET } = require("../GameManager");

const FOLD_THRESHOLD = 0.10;
const RAISE_THRESHOLD = 0.70;
const AGGRESSION_MULTIPLIER = 0.5;
const BLUFF_MAX = 0.10;

class LoosePassiveBot extends PokerEngine {
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
    if (stack <= chipsToCall + raiseAmount) return new Action(ActionType.ALL_IN);
    return new Action(ActionType.RAISE, raiseAmount);
  }

  _decidePostFlop(state) {
    const { chipsToCall, stack, pot, activePlayers } = state;
    const strength = normalizeHandStrength(state);
    const equity = discountForOpponents(strength, activePlayers);
    const effectiveScore = equity + Math.random() * BLUFF_MAX;

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

module.exports = LoosePassiveBot;
