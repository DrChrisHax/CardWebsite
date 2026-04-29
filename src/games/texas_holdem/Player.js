class Player {
  constructor(id, name, stack, position) {
    if (new.target === Player) {
      throw new Error("Player is abstract and cannot be instantiated directly");
    }
    this.id = id;
    this.name = name;
    this.stack = stack;
    this.position = position;
    this.holeCards = [];
    this.isActive = true; // still in the current hand
    this.currentBet = 0; // chips committed this street
  }

  async act(state) {
    throw new Error("act() must be implemented by subclass");
  }
}

class HumanPlayer extends Player {
  constructor(id, name, stack, position, sendState, waitForAction) {
    super(id, name, stack, position);
    this._sendState = sendState; // fn(state) — push decision state to client
    this._waitForAction = waitForAction; // fn() => Promise<Action>
  }

  async act(state) {
    this._sendState(state);
    return await this._waitForAction();
  }
}

class BotPlayer extends Player {
  constructor(id, name, stack, position, engine) {
    super(id, name, stack, position);
    this.engine = engine;
  }

  async act(state) {
    return this.engine.decide(state);
  }
}

module.exports = { Player, HumanPlayer, BotPlayer };
