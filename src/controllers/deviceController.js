// controllers/deviceController.js
const mongoose = require("mongoose");
const Device = require("../models/device");
const Config = require("../models/config");
const Command = require("../models/command");
const Respond = require("../utils/respond");

const ActivityChunk = require("../models/activityChunk"); // uses endAt + logTotals.*  ✅

const ACTIVITY_TZ_OFFSET_MINUTES = 5 * 60; // Asia/Karachi (+05:00)

/**
 * Compute "today" window in a fixed offset timezone.
 */
function getTodayWindowForOffset(offsetMinutes) {
  const nowUtcMs = Date.now();
  const offsetMs = offsetMinutes * 60 * 1000;

  // Convert current UTC time to "local" time in the target TZ
  const local = new Date(nowUtcMs + offsetMs);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth(); // 0-based
  const day = local.getUTCDate();

  const startUtcMs = Date.UTC(year, month, day) - offsetMs;
  const endUtcMs = Date.UTC(year, month, day + 1) - offsetMs;

  return {
    startOfToday: new Date(startUtcMs),
    startOfTomorrow: new Date(endUtcMs),
  };
}

/**
 * Compute start/end for a specific calendar date in the offset timezone.
 * dateStr is expected as "YYYY-MM-DD".
 */
function getDayWindowForOffset(offsetMinutes, dateStr) {
  if (!dateStr) {
    return getTodayWindowForOffset(offsetMinutes);
  }

  try {
    const [yearStr, monthStr, dayStr] = dateStr.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1–12
    const day = parseInt(dayStr, 10);

    if (!year || !month || !day) {
      return getTodayWindowForOffset(offsetMinutes);
    }

    const offsetMs = offsetMinutes * 60 * 1000;

    const startUtcMs = Date.UTC(year, month - 1, day) - offsetMs;
    const endUtcMs = Date.UTC(year, month - 1, day + 1) - offsetMs;

    return {
      startOfToday: new Date(startUtcMs),
      startOfTomorrow: new Date(endUtcMs),
    };
  } catch (e) {
    console.error("getDayWindowForOffset error:", e);
    return getTodayWindowForOffset(offsetMinutes);
  }
}

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
// DAY activity batch
// Uses ActivityChunk with: deviceId, endAt, logTotals.activeTime, logTotals.idleTime
// Sums chunks for the requested day per device. If none, returns {} and UI shows "no data".
// ---------------------------
async function fetchActivityTodayBatch(deviceIds, dateStr) {
  if (!Array.isArray(deviceIds) || deviceIds.length === 0) return {};

  const cfg = await Config.findOne({}).lean();
  const chunkTimeSec = cfg?.chunkTime || 300; // default 5 min
  const idleThresholdPerChunk = cfg?.idleThresholdPerChunk || 60;

  const nowMs = Date.now();

  const { startOfToday, startOfTomorrow } = getDayWindowForOffset(
    ACTIVITY_TZ_OFFSET_MINUTES,
    dateStr
  );

  const rows = await ActivityChunk.aggregate([
    {
      $match: {
        deviceId: { $in: deviceIds },
        endAt: { $gte: startOfToday, $lt: startOfTomorrow },
      },
    },
    { $sort: { endAt: 1 } }, // earliest → latest
    {
      $group: {
        _id: "$deviceId",
        activeSeconds: { $sum: { $ifNull: ["$logTotals.activeTime", 0] } },
        idleSeconds: { $sum: { $ifNull: ["$logTotals.idleTime", 0] } },
        firstChunkAt: { $first: "$endAt" },
        lastChunkAt: { $last: "$endAt" },
        lastChunkActive: { $last: "$logTotals.activeTime" },
        lastChunkIdle: { $last: "$logTotals.idleTime" },
      },
    },
  ]).allowDiskUse(true);

  const out = {};
  for (const r of rows) {
    const active = Math.max(0, Math.floor(Number(r.activeSeconds || 0)));
    const idle = Math.max(0, Math.floor(Number(r.idleSeconds || 0)));

    const firstChunkAt = r.firstChunkAt || null;
    const lastChunkAt = r.lastChunkAt || null;
    const lastActive = Number(r.lastChunkActive || 0);
    const lastIdle = Number(r.lastChunkIdle || 0);

    let activityState = null; // "active" | "idle" | null

    if (lastChunkAt) {
      const ageSec = (nowMs - lastChunkAt.getTime()) / 1000;
      const freshnessSec =
        (chunkTimeSec || 300) + (idleThresholdPerChunk || 60);

      if (ageSec <= freshnessSec) {
        activityState = lastActive > lastIdle ? "active" : "idle";
      } else {
        activityState = "idle";
      }
    }

    out[r._id] = {
      activeSeconds: active,
      idleSeconds: idle,
      firstChunkAt,
      lastChunkAt,
      activityState,
    };
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
exports.listOptimized = async (req, res) => {
  try {
    const now = Date.now();
    const config = await Config.findOne({}).lean();
    const devices = await Device.find({}).lean();
    const deviceIds = devices.map((d) => d.deviceId);

    // Optional ?date=YYYY-MM-DD in activity timezone (Asia/Karachi)
    const dateStr =
      typeof req.query.date === "string" && req.query.date.trim()
        ? req.query.date.trim()
        : undefined;

    const [cmdMap, actMap] = await Promise.all([
      fetchCommandSummaries(deviceIds),
      fetchActivityTodayBatch(deviceIds, dateStr),
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
        serviceStatus: presence.serviceStatus,
        lastSeen: presence.lastSeen,

        // command snapshots
        commandsSummary: {
          lastPending: cmd.lastPending || null,
          lastAck: cmd.lastAck || null,
          totals: cmd.totals || {
            pending: 0,
            acknowledged: 0,
            completed: 0,
          },
        },

        // activity for selected day
        activityToday,
      };
    });

    return Respond.ok(res, enriched, "Devices (optimized) fetched");
  } catch (err) {
    console.error("listOptimized error:", err);
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

