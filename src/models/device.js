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
    currentIdleStretchSeconds: { type: Number, default: 0 }, // derived: seconds since idleStreakStartAt
    idleStreakStartAt: Date, // when the current idle streak started; cleared on any active chunk
    lastMatrixIdleNotifiedAt: Date, // set when Matrix is notified, cleared when device becomes active again
  },
  { timestamps: true }
);

module.exports = mongoose.model('Device', deviceSchema);;
