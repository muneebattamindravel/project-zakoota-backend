const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true },
    username: String,
    userId: String,
    name: String,
    designation: String,
    profileURL: String,
    checkInTime: Date,

    // NEW
    lastClientHeartbeat: Date,
    lastServiceHeartbeat: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Device', deviceSchema);
