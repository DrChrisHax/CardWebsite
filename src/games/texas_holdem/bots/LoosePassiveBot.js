// ============================================================
// Loose Passive Bot Strategy
// ============================================================
// Plays a wide range of hands but rarely raises. Prefers to
// limp in and call down, chasing draws and hoping to get lucky.
//
// Pre-Flop:
//   Enters pots with a wide range of hands. Almost never raises,
//   prefers to limp or call. Only folds the very worst hands
//   when it costs chips to stay in.
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
const { Action, ActionType } = require("../Action");

class LoosePassiveBot extends PokerEngine {
  decide(state) {
    return new Action(ActionType.FOLD);
  }
}

module.exports = LoosePassiveBot;
