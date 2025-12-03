const Device = require("../models/device");
const Config = require("../models/config");
const Command = require("../models/command");
const Respond = require("../utils/respond");

// exports.list = async (_req, res) => {
//   try {
//     // ✅ Load config (values are stored in seconds)
//     const config = await Config.findOne({}).lean();

//     // Convert seconds → milliseconds
//     const clientDelayMs = (config?.clientHeartbeatDelay ?? 60) * 1000;
//     const serviceDelayMs = (config?.serviceHeartbeatDelay ?? 120) * 1000;

//     // ✅ Add a 50% cushion (grace period)
//     const GRACE_MULTIPLIER = 1.5;

//     const now = Date.now();
//     const devices = await Device.find({}).lean();

//     const enriched = devices.map((d) => {
//       const lastClientTime = d.lastClientHeartbeat
//         ? new Date(d.lastClientHeartbeat).getTime()
//         : 0;
//       const lastServiceTime = d.lastServiceHeartbeat
//         ? new Date(d.lastServiceHeartbeat).getTime()
//         : 0;

//       // Compute thresholds with grace buffer
//       const clientThreshold = clientDelayMs * GRACE_MULTIPLIER;
//       const serviceThreshold = serviceDelayMs * GRACE_MULTIPLIER;

//       // Time since last heartbeat
//       const clientDiff = now - lastClientTime;
//       const serviceDiff = now - lastServiceTime;

//       // Determine online/offline
//       const clientAlive = lastClientTime && clientDiff < clientThreshold;
//       const serviceAlive = lastServiceTime && serviceDiff < serviceThreshold;

//       // Compute latest heartbeat time
//       const lastSeen =
//         lastClientTime || lastServiceTime
//           ? new Date(Math.max(lastClientTime, lastServiceTime))
//           : null;

//       // Debug log (optional)
//       console.log(
//         `[${d.deviceId}] clientDiff=${clientDiff}ms (thr=${clientThreshold}ms) → ${clientAlive ? "ONLINE" : "OFFLINE"
//         }`
//       );

//       return {
//         ...d,
//         clientStatus: clientAlive ? "online" : "offline",
//         serviceStatus: serviceAlive ? "online" : "offline",
//         lastSeen,
//       };
//     });

//     return Respond.ok(res, enriched, "Devices fetched successfully");
//   } catch (err) {
//     console.error("Error listing devices:", err);
//     return Respond.error(
//       res,
//       "server_error",
//       "Failed to list devices",
//       err.message
//     );
//   }
// };

/** ---------------------------
 * Presence helpers (online/offline)
 * Your config stores delays in SECONDS; we convert to ms.
 * GRACE_MULTIPLIER gives the cushion (default 1.5x = 30%+ buffer).
 * --------------------------- */
function enrichPresence(dev, cfg, nowMs) {
  const clientDelayMs = ((cfg?.clientHeartbeatDelay ?? 60) * 1000);
  const serviceDelayMs = ((cfg?.serviceHeartbeatDelay ?? 120) * 1000);
  const GRACE_MULTIPLIER = 1.5;

  const lastClientMs = dev.lastClientHeartbeat ? new Date(dev.lastClientHeartbeat).getTime() : 0;
  const lastServiceMs = dev.lastServiceHeartbeat ? new Date(dev.lastServiceHeartbeat).getTime() : 0;

  const clientAlive  = lastClientMs  && (nowMs - lastClientMs  < clientDelayMs  * GRACE_MULTIPLIER);
  const serviceAlive = lastServiceMs && (nowMs - lastServiceMs < serviceDelayMs * GRACE_MULTIPLIER);

  const lastSeen = (lastClientMs || lastServiceMs)
    ? new Date(Math.max(lastClientMs, lastServiceMs))
    : null;

  return {
    clientStatus: clientAlive ? "online" : "offline",
    serviceStatus: serviceAlive ? "online" : "offline",
    lastSeen,
  };
}

/** ---------------------------
 * Command summaries (batched)
 * Returns { [deviceId]: { lastPending?, lastAck?, totals? } }
 * --------------------------- */
async function fetchCommandSummaries(deviceIds) {
  if (!deviceIds.length) return {};

  // Last pending
  const lastPending = await Command.aggregate([
    { $match: { deviceId: { $in: deviceIds }, status: "pending" } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$deviceId",
        doc: {
          $first: {
            _id: "$_id",
            type: "$type",
            target: "$target",
            createdAt: "$createdAt",
            payload: "$payload",
            status: "$status",
          },
        },
      },
    },
  ]);

  // Last ack (acknowledged or completed)
  const lastAck = await Command.aggregate([
    {
      $match: {
        deviceId: { $in: deviceIds },
        status: { $in: ["acknowledged", "completed"] },
      },
    },
    { $sort: { acknowledgedAt: -1, createdAt: -1 } },
    {
      $group: {
        _id: "$deviceId",
        doc: {
          $first: {
            _id: "$_id",
            type: "$type",
            target: "$target",
            acknowledgedAt: "$acknowledgedAt",
            createdAt: "$createdAt",
            payload: "$payload",
            status: "$status",
          },
        },
      },
    },
  ]);

  // Totals per status
  const totals = await Command.aggregate([
    { $match: { deviceId: { $in: deviceIds } } },
    {
      $group: {
        _id: { deviceId: "$deviceId", status: "$status" },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: "$_id.deviceId",
        counts: { $push: { k: "$_id.status", v: "$count" } },
      },
    },
    {
      $project: {
        _id: 1,
        totals: { $arrayToObject: "$counts" },
      },
    },
  ]);

  const map = {};
  for (const p of lastPending) map[p._id] = { ...(map[p._id] || {}), lastPending: p.doc };
  for (const a of lastAck)     map[a._id] = { ...(map[a._id] || {}), lastAck: a.doc };
  for (const t of totals)      map[t._id] = { ...(map[t._id] || {}), totals: t.totals };
  return map;
}

/** ---------------------------
 * TODAY activity batch (optional)
 * If you already compute/store today's activity (activeSeconds/idleSeconds),
 * return { [deviceId]: { activeSeconds, idleSeconds } }.
 * Otherwise return {} and UI shows "no data".
 * --------------------------- */
async function fetchActivityTodayBatch(_deviceIds) {
  // Wire this to your analytics/chunks if available.
  // Returning {} keeps things safe/compatible today.
  return {};
}

/** ===========================
 * EXISTING list (kept intact)
 * =========================== */
exports.list = async (_req, res) => {
  try {
    const config = await Config.findOne({}).lean();
    const now = Date.now();
    const devices = await Device.find({}).lean();

    const enriched = devices.map((d) => {
      const presence = enrichPresence(d, config, now);
      const lastClientTime = d.lastClientHeartbeat ? new Date(d.lastClientHeartbeat).getTime() : 0;
      const lastServiceTime = d.lastServiceHeartbeat ? new Date(d.lastServiceHeartbeat).getTime() : 0;
      const lastSeen = (lastClientTime || lastServiceTime)
        ? new Date(Math.max(lastClientTime, lastServiceTime))
        : null;

      return {
        ...d,
        clientStatus: presence.clientStatus,
        serviceStatus: presence.serviceStatus,
        lastSeen,
      };
    });

    return Respond.ok(res, enriched, "Devices fetched successfully");
  } catch (err) {
    console.error("Error listing devices:", err);
    return Respond.error(res, "server_error", "Failed to list devices", err.message);
  }
};

/** ===========================================
 * NEW: listOptimized (everything in one call)
 * =========================================== */
exports.listOptimized = async (_req, res) => {
  try {
    const now = Date.now();
    const config = await Config.findOne({}).lean();
    const devices = await Device.find({}).lean();
    const deviceIds = devices.map((d) => d.deviceId);

    const [cmdMap, actMap] = await Promise.all([
      fetchCommandSummaries(deviceIds),
      fetchActivityTodayBatch(deviceIds),
    ]);

    const enriched = devices.map((d) => {
      const presence = enrichPresence(d, config, now);
      const cmd = cmdMap[d.deviceId] || {};
      const activityToday = actMap[d.deviceId] || d.activityToday || null;

      return {
        _id: d._id,
        deviceId: d.deviceId,
        name: d.name,
        username: d.username,
        designation: d.designation,
        profileURL: d.profileURL,
        createdAt: d.createdAt,

        // presence
        clientStatus: presence.clientStatus,
        lastSeen: presence.lastSeen,

        // command snapshots
        commandsSummary: {
          lastPending: cmd.lastPending || null,
          lastAck: cmd.lastAck || null,
          totals: cmd.totals || { pending: 0, acknowledged: 0, completed: 0 },
        },

        // activity
        activityToday, // {activeSeconds, idleSeconds} | null
      };
    });

    return Respond.ok(res, enriched, "Devices (optimized) fetched");
  } catch (err) {
    console.error("listOptimized error:", err);
    return Respond.error(res, "server_error", "Failed to list devices", err.message);
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

