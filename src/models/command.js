const mongoose = require('mongoose');

const commandSchema = new mongoose.Schema(
    {
        deviceId: { type: String, required: true, index: true },
        type: { type: String, required: true }, // restart_logger, show_message, restart_service
        payload: { type: Object, default: {} },
        status: { type: String, enum: ['pending', 'acknowledged', 'completed'], default: 'pending' },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Command', commandSchema);
