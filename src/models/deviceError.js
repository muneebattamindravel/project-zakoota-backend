const mongoose = require('mongoose');

const deviceErrorSchema = new mongoose.Schema(
    {
        deviceId: { type: String, required: true, index: true },
        errorType: { type: String, required: true },
        message: { type: String, required: true },
        stack: { type: String },
        context: { type: Object },
    },
    { timestamps: true }
);

module.exports = mongoose.model('DeviceError', deviceErrorSchema);
