const Device = require("../models/device");
const Config = require("../models/config");
const Command = require("../models/command");
const Respond = require("../utils/respond");

exports.list = async (_req, res) => {
  try {
    // ✅ Load config (values are stored in seconds)
    const config = await Config.findOne({}).lean();

    // Convert seconds → milliseconds
    const clientDelayMs = (config?.clientHeartbeatDelay ?? 60) * 1000;
    const serviceDelayMs = (config?.serviceHeartbeatDelay ?? 120) * 1000;

    // ✅ Add a 50% cushion (grace period)
    const GRACE_MULTIPLIER = 1.5;

    const now = Date.now();
    const devices = await Device.find({}).lean();

    const enriched = devices.map((d) => {
      const lastClientTime = d.lastClientHeartbeat
        ? new Date(d.lastClientHeartbeat).getTime()
        : 0;
      const lastServiceTime = d.lastServiceHeartbeat
        ? new Date(d.lastServiceHeartbeat).getTime()
        : 0;

      // Compute thresholds with grace buffer
      const clientThreshold = clientDelayMs * GRACE_MULTIPLIER;
      const serviceThreshold = serviceDelayMs * GRACE_MULTIPLIER;

      // Time since last heartbeat
      const clientDiff = now - lastClientTime;
      const serviceDiff = now - lastServiceTime;

      // Determine online/offline
      const clientAlive = lastClientTime && clientDiff < clientThreshold;
      const serviceAlive = lastServiceTime && serviceDiff < serviceThreshold;

      // Compute latest heartbeat time
      const lastSeen =
        lastClientTime || lastServiceTime
          ? new Date(Math.max(lastClientTime, lastServiceTime))
          : null;

      // Debug log (optional)
      console.log(
        `[${d.deviceId}] clientDiff=${clientDiff}ms (thr=${clientThreshold}ms) → ${clientAlive ? "ONLINE" : "OFFLINE"
        }`
      );

      return {
        ...d,
        clientStatus: clientAlive ? "online" : "offline",
        serviceStatus: serviceAlive ? "online" : "offline",
        lastSeen,
      };
    });

    return Respond.ok(res, enriched, "Devices fetched successfully");
  } catch (err) {
    console.error("Error listing devices:", err);
    return Respond.error(
      res,
      "server_error",
      "Failed to list devices",
      err.message
    );
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

