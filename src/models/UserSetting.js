const mongoose = require("mongoose");

const userSettingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  settingName: { type: String, required: true },
  value: { type: String, required: true },
});

const DEFAULT_SETTINGS = [
  { settingName: "CardStyle", value: "Kenny Cards Large" },
];

userSettingSchema.statics.populateDefaults = async function (userId) {
  const docs = DEFAULT_SETTINGS.map((s) => ({ userId, ...s }));
  await this.insertMany(docs);
};

module.exports = mongoose.model("UserSetting", userSettingSchema);
