const PokerEngine = require("./PokerEngine");
const { Action, ActionType } = require("../Action");

class CallBot extends PokerEngine {
  decide(state) {
    if (state.chipsToCall === 0) {
      return new Action(ActionType.CHECK);
    }
    if (state.chipsToCall >= state.stack) {
      return new Action(ActionType.ALL_IN);
    }
    return new Action(ActionType.CALL);
  }
}

module.exports = CallBot;
