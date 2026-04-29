const PokerEngine = require("./PokerEngine");
const { Action, ActionType } = require("../Action");

class FoldBot extends PokerEngine {
  decide(state) {
    if (state.chipsToCall === 0) {
      return new Action(ActionType.CHECK);
    }
    if (state.chipsToCall <= 2) {
      return new Action(ActionType.CALL);
    }
    return new Action(ActionType.FOLD);
  }
}

module.exports = FoldBot;
