const CallBot = require("./bots/CallBot");

// Maps model string (from DB) -> factory function
module.exports = {
  CallBot: () => new CallBot(),
};
