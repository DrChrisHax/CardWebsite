const mongoose = require("mongoose");

const aiSeatSchema = new mongoose.Schema(
  {
    seat: { type: Number, required: true },
    aiPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: "AIPlayer" },
    displayName: { type: String, required: true },
    model: { type: String, required: true },
    chips: { type: Number, default: 1000 }, // 0 means the AI is out
  },
  { _id: false },
);

const gameStateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true },
  status: { type: String, default: "active" }, // 'active' | 'completed'
  dealerSeat: { type: Number, default: 0 },
  handCount: { type: Number, default: 0 },
  aiSeats: [aiSeatSchema],
  currentHand: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("GameState", gameStateSchema);
