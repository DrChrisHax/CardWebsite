const { ActionType } = require("../Action");

class PokerEngine {
  constructor() {
    if (new.target === PokerEngine) {
      throw new Error(
        "PokerEngine is abstract and cannot be instantiated directly",
      );
    }
  }

  decide(state) {
    throw new Error("decide() must be implemented by subclass");
  }

  getLegalActions(state) {
    const actions = [ActionType.FOLD];

    if (state.chipsToCall === 0) {
      actions.push(ActionType.CHECK);
    } else {
      actions.push(ActionType.CALL);
    }

    if (state.stack > state.chipsToCall && state.minRaise <= state.maxBet) {
      actions.push(ActionType.RAISE);
    }

    if (state.stack > 0) {
      actions.push(ActionType.ALL_IN);
    }

    return actions;
  }

  validateAction(action, state) {
    return this.getLegalActions(state).includes(action.type);
  }
}

module.exports = PokerEngine;
