import mongoose, { Schema, Document } from 'mongoose';

export interface IConfig extends Document {
  chunkTime: number;                // in seconds
  idleThresholdPerChunk: number;    // in seconds
  screenshotRequired: boolean;
}

const configSchema = new Schema<IConfig>({
  chunkTime: { type: Number, required: true, default: 300 }, // default: 5 mins
  idleThresholdPerChunk: { type: Number, required: true, default: 60 },
  screenshotRequired: { type: Boolean, required: true, default: false },
}, { timestamps: true });

export default mongoose.model<IConfig>('Config', configSchema);
