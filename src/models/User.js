const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now },
  deactivatedOn: { type: Date, default: null },
  balance: { type: Number, default: 1000 },
});

userSchema.statics.usernameExists = async function (username) {
  return !!(await this.exists({ username }));
};

userSchema.statics.emailExists = async function (email) {
  return !!(await this.exists({ email: email.toLowerCase() }));
};

userSchema.statics.findByIdentifier = async function (identifier) {
  return this.findOne({
    $or: [{ username: identifier }, { email: identifier.toLowerCase() }],
  });
};

module.exports = mongoose.model("User", userSchema);
