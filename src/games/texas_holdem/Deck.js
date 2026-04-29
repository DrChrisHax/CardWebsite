const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const SUITS = ["s", "h", "d", "c"];

class Deck {
  constructor() {
    this.cards = [];
    for (const rank of RANKS) {
      for (const suit of SUITS) {
        this.cards.push(rank + suit);
      }
    }
    this.shuffle();
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal(n = 1) {
    if (this.cards.length < n)
      throw new Error("Not enough cards remaining in deck");
    return this.cards.splice(0, n);
  }

  get remaining() {
    return this.cards.length;
  }
}

module.exports = Deck;
