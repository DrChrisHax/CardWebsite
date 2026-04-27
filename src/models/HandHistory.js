const mongoose = require("mongoose");

const handHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true },
  gameStateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GameState",
    required: true,
  },
  handNumber: { type: Number, required: true }, // global sequential per user, never resets
  result: { type: String }, // 'win' | 'loss' | 'fold' | 'split'
  amountBet: { type: Number, default: 0 },
  amountWon: { type: Number, default: 0 },
  balanceAfter: { type: Number },
  playerHand: [String], // hole cards e.g. ['As', 'Kd']
  communityCards: [String], // final 5 board cards
  winningHandType: { type: String, default: null },
  roundEliminated: { type: String, default: null }, // null = went to showdown
  createdOn: { type: Date, default: Date.now },
});

module.exports = mongoose.model("HandHistory", handHistorySchema);
