const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true },
    username: String, //This could be the identifying name
    userId: String, //This will be the userId which will link the two systems (matrix and zakoota)
    name: String, //This is the display name
    designation: String,
    profileURL: String,
    checkInTime: Date,
    lastClientHeartbeat: Date,
    lastServiceHeartbeat: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Device', deviceSchema);
