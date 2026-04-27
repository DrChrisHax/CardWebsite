const mongoose = require("mongoose");

const DEFAULT_SETTINGS = [
  { settingName: "CardStyle", value: "Kenny Cards Large" },
];

const userSettingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  settingName: { type: String, required: true },
  value: { type: String, required: true },
});

userSettingSchema.statics.populateDefaults = async function (userId) {
  const docs = DEFAULT_SETTINGS.map((s) => ({ userId, ...s }));
  await this.insertMany(docs);
};

module.exports = mongoose.model("UserSetting", userSettingSchema);
