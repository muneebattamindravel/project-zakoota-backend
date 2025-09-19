// controllers/commandController.js
const { v4: uuidv4 } = require('uuid');
const Command = require('../models/command');
const Device = require('../models/device');

const ALLOWED_TYPES = new Set(['restart_logger', 'show_message', 'restart_service']);

exports.createCommand = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { type, payload } = req.body || {};

        if (!deviceId) return res.status(400).json({ ok: false, error: 'deviceId is required' });
        if (!type || !ALLOWED_TYPES.has(type)) {
            return res.status(400).json({ ok: false, error: 'Invalid or missing command type' });
        }

        const device = await Device.findOne({ deviceId }).lean();
        if (!device) return res.status(404).json({ ok: false, error: 'Device not found' });

        // Optional: prevent flooding same command type while one is in-flight
        const duplicate = await Command.exists({ deviceId, type, status: { $in: ['pending', 'acknowledged'] } });
        if (duplicate) {
            return res.status(409).json({ ok: false, error: 'A similar command is already pending/acknowledged' });
        }

        const command = new Command({
            deviceId,
            commandId: uuidv4(),
            type,
            payload: payload || {}
        });

        await command.save();
        res.json({ ok: true, data: command });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
};

exports.completeCommand = async (req, res) => {
    try {
        const { commandId } = req.params;
        if (!commandId) return res.status(400).json({ ok: false, error: 'commandId is required' });

        const command = await Command.findOneAndUpdate(
            { commandId },
            { status: 'completed', completedAt: new Date() },
            { new: true }
        );

        if (!command) return res.status(404).json({ ok: false, error: 'Command not found' });
        res.json({ ok: true, data: command });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
};

// For device agents polling
exports.getPendingCommand = async (deviceId) => {
    if (!deviceId) return null;
    const cmd = await Command.findOneAndUpdate(
        { deviceId, status: 'pending' },
        { status: 'acknowledged', acknowledgedAt: new Date() },
        { sort: { createdAt: -1 }, new: true }
    ).lean();
    return cmd || null;
};
