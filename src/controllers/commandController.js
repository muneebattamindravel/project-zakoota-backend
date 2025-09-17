const { v4: uuidv4 } = require('uuid');
const Command = require('../models/command');

exports.createCommand = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { type, payload } = req.body;

        const command = new Command({
            deviceId,
            commandId: uuidv4(),
            type,
            payload,
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
        const command = await Command.findOneAndUpdate(
            { commandId },
            { status: 'completed' },
            { new: true }
        );
        if (!command) return res.status(404).json({ ok: false, error: 'Command not found' });

        res.json({ ok: true, data: command });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
};

exports.getPendingCommand = async (deviceId) => {
    const cmd = await Command.findOneAndUpdate(
        { deviceId, status: 'pending' },
        { status: 'acknowledged' },
        { sort: { createdAt: -1 }, new: true }
    );
    return cmd;
};
