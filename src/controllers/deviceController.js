const Device = require("../models/device");
const Command = require('../models/command');
const Respond = require("../utils/respond");

exports.list = async (_req, res) => {
  const devices = await Device.find({}).lean();
  const now = Date.now();
  const enriched = devices.map(d => {
    let status = d.status || 'unknown';
    if (d.lastSeen) {
      const diff = now - new Date(d.lastSeen).getTime();
      status = diff < 2 * 60 * 1000 ? 'online' : diff < 10 * 60 * 1000 ? 'idle' : 'offline';
    }
    return { ...d, status };
  });
  return Respond.ok(res, { devices: enriched }, 'Devices listed');
};

exports.assignDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { username, userId, profileURL, name, designation, checkInTime } = req.body;

    const device = await Device.findOneAndUpdate(
      { deviceId },
      {
        $set: {
          username,
          userId,
          profileURL,
          name,
          designation,
          checkInTime: checkInTime ? new Date(checkInTime) : new Date(),
        },
      },
      { new: true, upsert: true }
    );

    res.json({ data: device });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// NEW: delete all devices
exports.deleteAllDevices = async (req, res) => {
  await Device.deleteMany({});
  res.json({ ok: true, message: "All devices deleted" });
};

exports.heartbeat = async (req, res) => {
  try {
    const { deviceId, type } = req.body; // type = "client" | "service"
    if (!deviceId || !type) {
      return res.status(400).json({ error: "deviceId and type are required" });
    }

    const now = new Date();
    const update = {};

    if (type === "client") update.lastClientHeartbeat = now;
    if (type === "service") update.lastServiceHeartbeat = now;

    // 🔹 Update device heartbeat
    const device = await Device.findOneAndUpdate(
      { deviceId },
      { $set: update },
      { new: true, upsert: true }
    );

    let commands = [];
    if (type === "service") {
      // 🔹 Only fetch pending commands for service heartbeat
      const pending = await Command.find({ deviceId, status: "pending" }).sort({ createdAt: 1 });
      commands = pending.map(cmd => ({
        id: cmd._id,
        type: cmd.type,
        payload: cmd.payload,
      }));
    }

    res.json({
      ok: true,
      data: {
        device,
        commands,
      },
    });
  } catch (err) {
    console.error("heartbeat error:", err);
    res.status(500).json({ error: err.message });
  }
};
