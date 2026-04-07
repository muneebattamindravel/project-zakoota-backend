const mongoose = require('mongoose');

const configSchema = new mongoose.Schema(
  {
    chunkTime: { type: Number, required: true, default: 300 },
    idleThresholdPerChunk: { type: Number, required: true, default: 60 },
    isZaiminaarEnabled: { type: Boolean, required: true, default: false },

    clientHeartbeatDelay: { type: Number, required: true, default: 60 },   // seconds
    serviceHeartbeatDelay: { type: Number, required: true, default: 120 }, // seconds

    allowQuit: { type: Boolean, required: true, default: false },

    matrixIdleThresholdSeconds: { type: Number, default: 300 }, // seconds of idle before notifying Matrix

    version: { type: Number, required: true, default: 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Config', configSchema);
