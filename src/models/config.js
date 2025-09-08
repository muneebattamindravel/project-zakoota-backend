import mongoose from 'mongoose';

const configSchema = new mongoose.Schema(
  {
    chunkTime: { type: Number, required: true, default: 300 }, // default: 5 mins
    idleThresholdPerChunk: { type: Number, required: true, default: 60 }, // default: 1 min
    screenshotRequired: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('Config', configSchema);
