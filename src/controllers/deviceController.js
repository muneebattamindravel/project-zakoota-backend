// controllers/deviceController.js
const mongoose = require("mongoose");
const Device = require("../models/device");
const Config = require("../models/config");
const Command = require("../models/command");
const Respond = require("../utils/respond");

const ActivityChunk = require("../models/activityChunk"); // uses endAt + logTotals.*  ✅

// ---------------------------
// Presence helpers
// Config delays are in SECONDS -> convert to ms
// ---------------------------
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

// ---------------------------
// Command summaries (batched)
// Returns { [deviceId]: { lastPending?, lastAck?, totals? } }
// ---------------------------
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

  // Last acknowledged (or completed; your schema has pending/ack only)
  const lastAck = await Command.aggregate([
    {
      $match: {
        deviceId: { $in: deviceIds },
        status: { $in: ["acknowledged"] },
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

  // Totals by status
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

// ---------------------------
// TODAY activity batch (WORKING)
// Uses ActivityChunk with: deviceId, endAt, logTotals.activeTime, logTotals.idleTime
// Sums today's chunks per device. If none, returns {} and UI shows "no data".
// ---------------------------
async function fetchActivityTodayBatch(deviceIds) {
  if (!Array.isArray(deviceIds) || deviceIds.length === 0) return {};

  // Use local server "today" window; if you prefer UTC, replace with UTC start/end.
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);

  // Aggregate on endAt (indexed) for chunks that finished today.
  // Sum logTotals.activeTime / logTotals.idleTime (seconds per your schema).
  const rows = await ActivityChunk.aggregate([
    {
      $match: {
        deviceId: { $in: deviceIds },
        endAt: { $gte: startOfToday, $lt: startOfTomorrow },
      },
    },
    {
      $group: {
        _id: "$deviceId",
        activeSeconds: { $sum: { $ifNull: ["$logTotals.activeTime", 0] } },
        idleSeconds:   { $sum: { $ifNull: ["$logTotals.idleTime", 0] } },
      },
    },
  ]).allowDiskUse(true);

  const out = {};
  for (const r of rows) {
    const active = Math.max(0, Math.floor(Number(r.activeSeconds || 0)));
    const idle   = Math.max(0, Math.floor(Number(r.idleSeconds   || 0)));
    if (active > 0 || idle > 0) {
      out[r._id] = { activeSeconds: active, idleSeconds: idle };
    }
  }
  return out;
}

// ===========================
// EXISTING list (kept intact)
// ===========================
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

// ===========================================
// NEW: listOptimized (everything in one call)
// ===========================================
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
          totals: cmd.totals || { pending: 0, acknowledged: 0 },
        },

        // activity
        activityToday, // { activeSeconds, idleSeconds } | null
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

