const ActionType = Object.freeze({
  FOLD: "fold",
  CHECK: "check",
  CALL: "call",
  RAISE: "raise",
  ALL_IN: "all_in",
});

class Action {
  constructor(type, amount = 0) {
    this.type = type;
    this.amount = amount;
  }
}

module.exports = { ActionType, Action };
