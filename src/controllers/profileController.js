const User = require("../models/User");

async function deactivateAccount(req, res) {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { deactivatedOn: new Date() },
      { new: true },
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

module.exports = { deactivateAccount, deleteAccount };
