const mongoose = require("mongoose");

const DetailSchema = new mongoose.Schema({
  processName: { type: String, index: true },
  appName:     { type: String, index: true },
  title:       { type: String, default: '' },
  activeTime:  { type: Number, default: 0 },
  idleTime:    { type: Number, default: 0 },
  mouseMovements: { type: Number, default: 0 },
  mouseScrolls:   { type: Number, default: 0 },
  mouseClicks:    { type: Number, default: 0 },
  keysPressed:    { type: Number, default: 0 }
}, { _id: false });

const ActivityChunkSchema = new mongoose.Schema({
  deviceId: { type: String, index: true },

  userRef: {
    userId:   { type: String, default: null },
    username: { type: String, default: null }
  },

  startAt: { type: Date, index: true },
  endAt:   { type: Date, index: true },

  serverReceivedAt:   { type: Date, index: true, default: Date.now },
  serverClientDriftMs:{ type: Number, default: 0 },

  logClock: {
    clientSideTimeEpochMs: { type: Number, required: true },
    isTimeDirty:           { type: Boolean, default: false },
    clientTzOffsetMin:     { type: Number, default: 0 }
  },

  logTotals: {
    activeTime:     { type: Number, default: 0 },
    idleTime:       { type: Number, default: 0 },
    mouseMovements: { type: Number, default: 0 },
    mouseScrolls:   { type: Number, default: 0 },
    mouseClicks:    { type: Number, default: 0 },
    keysPressed:    { type: Number, default: 0 }
  },

  logDetails: [DetailSchema]
}, { timestamps: true });

// Idempotency for 5-min chunk
ActivityChunkSchema.index({ deviceId: 1, endAt: 1 }, { unique: true });
// Common query pattern
ActivityChunkSchema.index({ deviceId: 1, endAt: -1 });
// App analytics
ActivityChunkSchema.index({ deviceId: 1, 'logDetails.appName': 1, endAt: -1 });

module.exports = mongoose.model("ActivityChunk", ActivityChunkSchema);
