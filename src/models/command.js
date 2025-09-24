const mongoose = require('mongoose');

const commandSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },
    target: { type: String, enum: ['client', 'service'], required: true }, // NEW
    type: { type: String, required: true }, // validated in controller
    payload: { type: Object, default: {} },
    status: { type: String, enum: ['pending', 'acknowledged'], default: 'pending' },
    acknowledgedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Command', commandSchema);
