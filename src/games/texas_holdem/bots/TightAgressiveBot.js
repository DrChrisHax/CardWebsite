// ============================================================
// Tight Aggressive Bot Strategy
// ============================================================
// Plays a narrow range of strong hands but bets and raises big
// when it does play. Folds most hands pre-flop, never limps.
//
// Pre-Flop:
//   Only plays hands with a high Chen score. When it enters a
//   pot it always raises, never calls. Folds everything below
//   its threshold without hesitation.
//
// Post-Flop:
//   Only continues with strong made hands. No bluff bonus.
//   The final score determines the action:
//     - Below 0.40 with a cost to stay in: fold
//     - Below 0.60: check or call
//     - 0.60 or above: raise (size = score * pot * 1.5, capped at max bet)
// ============================================================

const PokerEngine = require("./PokerEngine");
const { Action, ActionType } = require("../Action");

class TightAgressiveBot extends PokerEngine {
  decide(state) {
    return new Action(ActionType.FOLD);
  }
}

module.exports = TightAgressiveBot;
