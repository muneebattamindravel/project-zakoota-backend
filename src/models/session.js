const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userAgent: { type: String },
    ip: { type: String },

    // Hard expiry
    expiresAt: { type: Date, required: true },

    // Revocation
    revokedAt: { type: Date },
    revokedReason: { type: String },
  },
  { timestamps: true }
);

// TTL index: automatically deletes expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);
