const mongoose = require("mongoose");

const userPurchasedGamesSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true },
});

module.exports = mongoose.model("UserPurchasedGames", userPurchasedGamesSchema);
