const DeviceError = require('../models/deviceError');

exports.logError = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { errorType, message, stack, context } = req.body;

        const errorDoc = new DeviceError({
            deviceId,
            errorType,
            message,
            stack,
            context,
        });

        await errorDoc.save();
        res.json({ ok: true, data: errorDoc });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
};

exports.listErrors = async (req, res) => {
    try {
        const errors = await DeviceError.find().sort({ createdAt: -1 }).limit(100);
        res.json({ ok: true, data: errors });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
};
