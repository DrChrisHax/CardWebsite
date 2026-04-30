const CallBot = require("./bots/CallBot");
const FoldBot = require("./bots/FoldBot");
const LooseAgressiveBot = require("./bots/LooseAgressiveBot");
const TightAgressiveBot = require("./bots/TightAgressiveBot");
const LoosePassiveBot = require("./bots/LoosePassiveBot");
const TightPassiveBot = require("./bots/TightPassiveBot");

// Maps model string (from DB) -> factory function
module.exports = {
  CallBot: () => new CallBot(),
  FoldBot: () => new FoldBot(),
  LooseAgressiveBot: () => new LooseAgressiveBot(),
  TightAgressiveBot: () => new TightAgressiveBot(),
  LoosePassiveBot: () => new LoosePassiveBot(),
  TightPassiveBot: () => new TightPassiveBot(),
};
