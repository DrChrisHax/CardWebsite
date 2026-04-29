const CallBot = require("./bots/CallBot");
const FoldBot = require("./bots/FoldBot");

// Maps model string (from DB) -> factory function
module.exports = {
  CallBot: () => new CallBot(),
  FoldBot: () => new FoldBot(),
};
