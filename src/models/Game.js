const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema({
  gameName: { type: String, required: true },
  path: { type: String, required: true },
  price: { type: Number, required: true, default: 0 },
  active: { type: Boolean, default: true },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now },
  deletedOn: { type: Date, default: null },
});

module.exports = mongoose.model("Game", gameSchema);
