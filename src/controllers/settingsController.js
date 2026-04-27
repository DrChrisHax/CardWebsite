const UserSetting = require("../models/UserSetting");

async function getSettings(req, res) {
  try {
    const settings = await UserSetting.find({ userId: req.userId }).select(
      "settingName value -_id",
    );
    return res.json(settings);
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}

async function updateSetting(req, res) {
  const { name } = req.params;
  const { value } = req.body;

  if (!value || typeof value !== "string" || !value.trim()) {
    return res.status(400).json({ error: "Value is required" });
  }

  try {
    const setting = await UserSetting.findOneAndUpdate(
      { userId: req.userId, settingName: name },
      { value: value.trim() },
      { new: true },
    ).select("settingName value -_id");

    if (!setting) return res.status(404).json({ error: "Setting not found" });
    return res.json(setting);
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = { getSettings, updateSetting };
