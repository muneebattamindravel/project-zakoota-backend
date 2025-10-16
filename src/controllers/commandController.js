// controllers/commandController.js
const { v4: uuidv4 } = require('uuid');
const Command = require('../models/command');
const Device = require('../models/device');

const ALLOWED_CLIENT = new Set([
  'show-popup-announcement',
  'show-popup-message',
  'show-popup-celebration',
  'focus-hours-start',
  'focus-hours-end',
  'hide',
  'refresh',
  'lock',
  'unlock',
  'ping',
  'attention',
  'disco',
  'rain',
  'samosa-party',
  'open-action',
  'quote',
  'requires-update',
]);

const ALLOWED_SERVICE = new Set([
  'restart-service',
  'restart-client',
]);

// Create a new command
exports.createCommand = async (req, res) => {
  try {
    const { target, type, payload, deviceId } = req.body || {};

    if (!deviceId) return res.status(400).json({ ok: false, error: 'deviceId is required' });
    if (!target || !['client', 'service'].includes(target)) {
      return res.status(400).json({ ok: false, error: 'Invalid or missing target' });
    }

    // Validate type based on target
    const allowed = target === 'client' ? ALLOWED_CLIENT : ALLOWED_SERVICE;
    if (!type || !allowed.has(type)) {
      return res.status(400).json({ ok: false, error: 'Invalid or missing command type for target' });
    }

    const device = await Device.findOne({ deviceId }).lean();
    if (!device) return res.status(404).json({ ok: false, error: 'Device not found' });

    const duplicate = await Command.exists({ deviceId, target, type, status: 'pending' });
    if (duplicate) {
      return res.status(409).json({ ok: false, error: 'A similar command is already pending' });
    }

    const command = new Command({
      deviceId,
      target,
      type,
      payload: payload || {},
    });

    await command.save();
    res.json({ ok: true, data: command });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};


// ✅ Return pending commands WITHOUT acknowledging (for heartbeat)
exports.getPendingCommands = async (req, res) => {
  try {
    const { deviceId } = req.params;
    if (!deviceId) {
      return res.status(400).json({ ok: false, error: 'deviceId is required' });
    }

    const device = await Device.findOne({ deviceId }).lean();
    if (!device) {
      return res.status(404).json({ ok: false, error: 'Device not found' });
    }

    const cmds = await Command.find({ deviceId, status: 'pending' }).sort({ createdAt: 1 }).lean();

    return res.json({ ok: true, data: cmds });
  } catch (err) {
    console.error('getPendingCommands error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

// ✅ Explicitly acknowledge a command
exports.acknowledgeCommand = async (req, res) => {
  try {
    const { commandId } = req.body;
    if (!commandId) return res.status(400).json({ ok: false, error: 'commandId is required' });

    const command = await Command.findOneAndUpdate(
      { _id: commandId, status: 'pending' },
      { status: 'acknowledged', acknowledgedAt: new Date() },
      { new: true }
    );

    if (!command) return res.status(404).json({ ok: false, error: 'Command not found or already acknowledged' });

    res.json({ ok: true, data: command });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

// ✅ List commands with filters
exports.listCommands = async (req, res) => {
  try {
    const { deviceId, status, from, to, limit = 50, skip = 0 } = req.query;

    const q = {};
    if (deviceId) q.deviceId = deviceId;
    if (status) q.status = status;

    if (from || to) {
      q.createdAt = {};
      if (from) q.createdAt.$gte = new Date(from);
      if (to) q.createdAt.$lte = new Date(to);
    }

    const docs = await Command.find(q)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    const total = await Command.countDocuments(q);

    res.json({ ok: true, data: docs, meta: { total, skip: Number(skip), limit: Number(limit) } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

// ✅ Delete all commands
exports.deleteAllCommands = async (req, res) => {
  try {
    await Command.deleteMany({});
    res.json({ ok: true, message: 'All commands deleted' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
