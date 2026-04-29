const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const sessionManager = require("../utils/sessionManager");

async function deactivateAccount(req, res) {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { deactivatedOn: new Date() },
      { returnDocument: "after" },
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ message: "Account deactivated" });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}

async function deleteAccount(req, res) {
  try {
    const user = await User.findByIdAndDelete(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ message: "Account deleted" });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}

async function reactivateAccount(req, res) {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const user = await User.findByIdentifier(identifier);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    if (!user.deactivatedOn)
      return res.status(400).json({ error: "Account is not deactivated" });

    user.deactivatedOn = null;
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    sessionManager.create(user._id, token);
    return res.json({ token });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = { deactivateAccount, deleteAccount, reactivateAccount };
