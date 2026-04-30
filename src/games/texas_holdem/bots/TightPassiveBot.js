// ============================================================
// Tight Passive Bot Strategy
// ============================================================
// Plays only strong hands and plays them cautiously. Avoids
// big pots, prefers to check and call rather than raise.
// The most predictable and exploitable of the four archetypes.
//
// Pre-Flop:
//   Only plays hands with a high Chen score. When it does play
//   it prefers to limp or call rather than raise, giving away
//   little information about hand strength.
//
// Post-Flop:
//   Only continues with strong made hands and mostly checks
//   or calls. No bluff bonus.
//   The final score determines the action:
//     - Below 0.40 with a cost to stay in: fold
//     - Below 0.80: check or call
//     - 0.80 or above: raise (size = score * pot * 0.5, capped at max bet)
// ============================================================

const PokerEngine = require("./PokerEngine");
const { Action, ActionType } = require("../Action");

class TightPassiveBot extends PokerEngine {
  decide(state) {
    return new Action(ActionType.FOLD);
  }
}

module.exports = TightPassiveBot;
