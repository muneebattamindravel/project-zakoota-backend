const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true },
    username: { type: String }, // existing field
    userId: { type: String },   // existing field

    // 🔹 New fields for assigned user info
    profileURL: { type: String, default: '' },
    name: { type: String, default: '' },
    designation: { type: String, default: '' },
    checkInTime: { type: Date, default: null },

    status: { type: String, default: 'offline' },
    lastSeen: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Device', deviceSchema);
