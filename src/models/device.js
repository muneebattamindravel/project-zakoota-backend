const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true, unique: true },
  name: { type: String, trim: true },
  type: { type: String, enum: ["sensor","bot","agent","other"], default: "other" },
  status: { type: String, enum: ["online","offline","idle","error"], default: "offline" },
  lastSeen: { type: Date },
  meta: { type: Object, default: {} },
}, { timestamps: true });

module.exports = mongoose.model("Device", deviceSchema);
