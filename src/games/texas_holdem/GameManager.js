const Deck = require("./Deck");
const { THGameState, Street } = require("./THGameState");
const { ActionType } = require("./Action");

class GameManager {
  constructor(players, smallBlind = 1, bigBlind = 2) {
    this.players = players; // Player[] ordered by seat
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.deck = null;
    this.communityCards = [];
    this.pot = 0;
    this.street = null;
    this.dealerIndex = 0;
    this.actionHistory = []; // full hand history across streets
  }

  async startHand() {
    throw new Error("Not yet implemented");
  }
}

module.exports = GameManager;
