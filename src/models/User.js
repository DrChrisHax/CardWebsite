const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username:     { type: String, required: true, unique: true },
  email:        { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  createdOn:    { type: Date, default: Date.now },
  updatedOn:    { type: Date, default: Date.now },
  deletedOn:    { type: Date, default: null },
});

module.exports = mongoose.model('User', userSchema);
