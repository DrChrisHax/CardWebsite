const Street = Object.freeze({
  PREFLOP: "preflop",
  FLOP: "flop",
  TURN: "turn",
  RIVER: "river",
});

const Position = Object.freeze({
  BTN: "btn",
  SB: "sb",
  BB: "bb",
  UTG: "utg",
  MP: "mp",
  CO: "co",
});

class THGameState {
  constructor({
    holeCards,
    communityCards,
    stack,
    chipsToCall,
    minRaise,
    maxBet,
    pot,
    position,
    street,
    activePlayers,
    actionHistory = [],
  }) {
    this.holeCards = holeCards; // string[] e.g. ['Ah', 'Kd']
    this.communityCards = communityCards; // string[] 0-5 cards
    this.stack = stack;
    this.chipsToCall = chipsToCall; // 0 means player can check
    this.minRaise = minRaise;
    this.maxBet = maxBet;
    this.pot = pot;
    this.position = position; // Position enum value
    this.street = street; // Street enum value
    this.activePlayers = activePlayers;
    this.actionHistory = actionHistory; // full hand history, reserved for future bots
  }
}

module.exports = { THGameState, Street, Position };
