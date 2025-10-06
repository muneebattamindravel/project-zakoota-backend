const Device = require("../models/device");
const Command = require('../models/command');
const Respond = require("../utils/respond");

exports.list = async (_req, res) => {
  try {
    // Get current config (contains heartbeat delays)
    const config = await Config.findOne({}).lean();
    const clientDelayMs = config?.clientHeartbeatDelay ?? 60000;
    const serviceDelayMs = config?.serviceHeartbeatDelay ?? 60000;

    const now = Date.now();
    const devices = await Device.find({}).lean();

    const enriched = devices.map((d) => {
      const lastClient = d.lastClientHeartbeat;
      const lastService = d.lastServiceHeartbeat;
      const lastSeen =
        lastClient && lastService
          ? new Date(
              Math.max(
                new Date(lastClient).getTime(),
                new Date(lastService).getTime()
              )
            )
          : lastClient || lastService || d.lastSeen || d.updatedAt;

      // Compute client status
      let clientStatus = "offline";
      if (lastClient) {
        const diff = now - new Date(lastClient).getTime();
        if (diff <= clientDelayMs * 1.5) clientStatus = "online";
      }

      // Compute service status
      let serviceStatus = "offline";
      if (lastService) {
        const diff = now - new Date(lastService).getTime();
        if (diff <= serviceDelayMs * 1.5) serviceStatus = "online";
      }

      // Combine into overall device status
      const status =
        clientStatus === "online" || serviceStatus === "online"
          ? "online"
          : "offline";

      return {
        ...d,
        clientStatus,
        serviceStatus,
        status,
        lastSeen,
      };
    });

    return Respond.ok(res, { devices: enriched }, "Devices listed");
  } catch (err) {
    console.error("Device list error:", err);
    return Respond.fail(res, err.message || "Failed to list devices");
  }
};

exports.assignDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { username, userId, profileURL, name, designation, checkInTime } = req.body;

    const device = await Device.findOne({ deviceId });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const deviceN = await Device.findOneAndUpdate(
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

    res.json({ data: deviceN });
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

    const device = await Device.findOneAndUpdate(
      { deviceId },
      { $set: update },
      { new: true, upsert: true }
    );

    // ✅ Fetch only commands for that type
    const pending = await Command.find({ deviceId, target: type, status: "pending" }).sort({ createdAt: 1 });
    const commands = pending.map(cmd => ({
      id: cmd._id,
      target: cmd.target,
      type: cmd.type,
      payload: cmd.payload,
    }));

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

