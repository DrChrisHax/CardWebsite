const mongoose = require("mongoose");

const aiPlayerSchema = new mongoose.Schema({
  playerName: { type: String, required: true },
  model: { type: String, required: true },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true },
  active: { type: Boolean, default: true },
});

module.exports = mongoose.model("AIPlayer", aiPlayerSchema);
