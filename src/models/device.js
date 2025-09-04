const mongoose = require("mongoose");

const DeviceSchema = new mongoose.Schema({
  deviceId: { type: String, unique: true, index: true },
  userId: { type: String, default: null },
  username: { type: String, default: null },
  notes: String,
  lastSeenAt: { type: Date, index: true }
}, { timestamps: true });

module.exports = mongoose.model("Device", DeviceSchema);
