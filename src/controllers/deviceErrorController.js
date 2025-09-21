const DeviceError = require('../models/deviceError');

exports.logError = async (req, res) => {
    try {
        const { deviceId } = req.body;
        const { errorType, message, stack, context } = req.body || {};

        if (!deviceId) return res.status(400).json({ ok: false, error: 'deviceId is required' });
        if (!errorType) return res.status(400).json({ ok: false, error: 'errorType is required' });
        if (!message) return res.status(400).json({ ok: false, error: 'message is required' });

        const errorDoc = new DeviceError({
            deviceId,
            errorType,
            message,
            stack,
            context
        });

        await errorDoc.save();
        res.json({ ok: true, data: errorDoc });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
};

exports.listErrors = async (req, res) => {
    try {
        const {
            deviceId, // optional filter
            errorType, // optional filter
            page = 1,
            limit = 50
        } = req.query;

        const q = {};
        if (deviceId) q.deviceId = deviceId;
        if (errorType) q.errorType = errorType;

        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

        const [items, total] = await Promise.all([
            DeviceError.find(q).sort({ createdAt: -1 }).skip((pageNum - 1) * pageSize).limit(pageSize).lean(),
            DeviceError.countDocuments(q)
        ]);

        res.json({
            ok: true,
            data: items,
            meta: { page: pageNum, limit: pageSize, total }
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
};