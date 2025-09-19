// src/controllers/logController.js
const Device = require("../models/device");
const ActivityChunk = require("../models/activityChunk");
const Respond = require("../utils/respond");
const { ingestBodyZ } = require("../validation/logSchemas");
const { guessAppName } = require("../utils/appNormalize");
const Config = require("../models/config");

// ---- INGEST ----
exports.ingest = async (req, res) => {
  const parsed = ingestBodyZ.safeParse(req.body);
  if (!parsed.success) {
    const details = (parsed.error?.issues || []).map(issue => ({
      path: Array.isArray(issue.path) ? issue.path.join(".") : String(issue.path),
      message: issue.message,
      code: issue.code
    }));
    return Respond.badRequest(res, "validation_error", "Invalid payload", { errors: details });
  }

  const now = new Date();
  const results = [];
  const ops = [];
  const touchedDeviceIds = new Set();

  // Load config with defaults
  const config = await Config.findOne();
  const chunkTime = config?.chunkTime ?? 300;
  const idleThresholdPerChunk = config?.idleThresholdPerChunk ?? 60;
  const isZaiminaarEnabled = config?.isZaiminaarEnabled ?? false;
  const configVersion = config?.version ?? 1;

  for (const c of parsed.data.chunks) {
    try {
      const endAt = new Date(c.logClock.clientSideTimeEpochMs);
      const startAt = new Date(endAt.getTime() - chunkTime * 1000);

      const device = await Device.findOne({ deviceId: c.deviceId });

      // normalize details
      const details = (c.logDetails || []).map(d => ({
        ...d,
        appName: d.appName || guessAppName({ processName: d.processName, title: d.title || "" })
      }));

      const totals = {
        activeTime: c.logTotals?.activeTime ?? 0,
        idleTime: c.logTotals?.idleTime ?? 0,
        mouseMovements: c.logTotals?.mouseMovements ?? 0,
        mouseScrolls: c.logTotals?.mouseScrolls ?? c.logTotals?.mouseScolls ?? 0,
        mouseClicks: c.logTotals?.mouseClicks ?? 0,
        keysPressed: c.logTotals?.keysPressed ?? 0
      };

      ops.push({
        updateOne: {
          filter: { deviceId: c.deviceId, endAt },
          update: {
            $setOnInsert: {
              deviceId: c.deviceId,
              startAt,
              endAt,
              serverReceivedAt: now
            },
            $set: {
              userRef: {
                userId: device?.userId || null,
                username: device?.username || null
              },
              serverClientDriftMs: now.getTime() - endAt.getTime(),
              logClock: c.logClock,
              logTotals: totals,
              logDetails: details,
              configSnapshot: {
                chunkTime,
                idleThresholdPerChunk,
                isZaiminaarEnabled,
                version: configVersion
              }
            }
          },
          upsert: true
        }
      });

      touchedDeviceIds.add(c.deviceId);

      results.push({
        deviceId: c.deviceId,
        endAtEpochMs: c.logClock.clientSideTimeEpochMs,
        status: "pending"
      });
    } catch (err) {
      console.error("ingest prepare error", err);
      results.push({
        deviceId: c.deviceId,
        endAtEpochMs: c.logClock?.clientSideTimeEpochMs,
        status: "failed",
        error: "prepare_error"
      });
    }
  }

  if (!ops.length) {
    return Respond.ok(res, { results }, "Nothing to ingest", {
      inserted: 0, updated: 0, duplicates: 0, failed: results.filter(r => r.status === "failed").length
    });
  }

  try {
    const write = await ActivityChunk.bulkWrite(ops, { ordered: false });
    let inserted = write.upsertedCount || 0;
    let updated = write.modifiedCount || 0;

    for (let r of results) {
      if (r.status !== "pending") continue;
      if (inserted > 0) { r.status = "inserted"; inserted--; continue; }
      if (updated > 0) { r.status = "updated"; updated--; continue; }
      r.status = "duplicate";
    }

    await Promise.all(Array.from(touchedDeviceIds).map(id => markDeviceSeen(id)));

    return Respond.ok(res, { results }, "Ingest complete", {
      inserted: write.upsertedCount || 0,
      updated: write.modifiedCount || 0,
      duplicates: results.filter(r => r.status === "duplicate").length
    });
  } catch (err) {
    console.error("bulkWrite error", err);
    results.forEach(r => { if (r.status === "pending") r.status = "failed"; });
    return Respond.error(res, "bulk_write_failed", "Ingest failed", { results });
  }
};

async function markDeviceSeen(deviceId) {
  await Device.findOneAndUpdate({ deviceId }, { $set: { lastSeen: new Date() } }, { upsert: true });
}

// ---- list, summary, apps, titles, missing, deleteAllLogs remain unchanged ----

/**
 * GET /api/logs
 */
exports.list = async (req, res) => {
  const { deviceId, from, to, limit = 50, skip = 0 } = req.query;
  if (!deviceId) return Respond.badRequest(res, "deviceId_required", "deviceId is required");

  const parseDate = (v) => (!v ? null : (isFinite(v) ? new Date(Number(v)) : new Date(v)));
  const fromDate = parseDate(from) || new Date(Date.now() - 24 * 3600 * 1000);
  const toDate = parseDate(to) || new Date();

  const docs = await ActivityChunk.find({
    deviceId,
    endAt: { $gte: fromDate, $lte: toDate }
  })
    .sort({ endAt: -1 })
    .skip(Number(skip))
    .limit(Number(limit))
    .lean();

  const total = await ActivityChunk.countDocuments({
    deviceId,
    endAt: { $gte: fromDate, $lte: toDate }
  });

  return Respond.paginated(res, { chunks: docs }, { total, limit: Number(limit), skip: Number(skip) });
};

/**
 * GET /api/logs/aggregate/summary
 */
exports.summary = async (req, res) => {
  const { deviceId, from, to } = req.query;
  if (!deviceId) return Respond.badRequest(res, "deviceId_required", "deviceId is required");

  const parseDate = (v) => (!v ? null : (isFinite(v) ? new Date(Number(v)) : new Date(v)));
  const fromDate = parseDate(from) || new Date(Date.now() - 24 * 3600 * 1000);
  const toDate = parseDate(to) || new Date();

  const [agg] = await ActivityChunk.aggregate([
    { $match: { deviceId, endAt: { $gte: fromDate, $lte: toDate } } },
    {
      $group: {
        _id: null,
        activeTime: { $sum: "$logTotals.activeTime" },
        idleTime: { $sum: "$logTotals.idleTime" },
        mouseMovements: { $sum: "$logTotals.mouseMovements" },
        mouseScrolls: { $sum: "$logTotals.mouseScrolls" },
        mouseClicks: { $sum: "$logTotals.mouseClicks" },
        keysPressed: { $sum: "$logTotals.keysPressed" },
        chunks: { $sum: 1 }
      }
    },
    { $project: { _id: 0 } }
  ]);

  return Respond.ok(res, {
    summary: agg || {
      activeTime: 0,
      idleTime: 0,
      mouseMovements: 0,
      mouseScrolls: 0,
      mouseClicks: 0,
      keysPressed: 0,
      chunks: 0
    }
  });
};

/**
 * GET /api/logs/aggregate/apps
 */
exports.apps = async (req, res) => {
  const { deviceId, from, to, top = 20 } = req.query;
  if (!deviceId) return Respond.badRequest(res, "deviceId_required", "deviceId is required");

  const parseDate = (v) => (!v ? null : (isFinite(v) ? new Date(Number(v)) : new Date(v)));
  const fromDate = parseDate(from) || new Date(Date.now() - 24 * 3600 * 1000);
  const toDate = parseDate(to) || new Date();

  const rows = await ActivityChunk.aggregate([
    { $match: { deviceId, endAt: { $gte: fromDate, $lte: toDate } } },
    { $unwind: "$logDetails" },
    {
      $group: {
        _id: "$logDetails.appName",
        activeTime: { $sum: "$logDetails.activeTime" },
        idleTime: { $sum: "$logDetails.idleTime" },
        mouseClicks: { $sum: "$logDetails.mouseClicks" },
        keysPressed: { $sum: "$logDetails.keysPressed" }
      }
    },
    { $sort: { activeTime: -1 } },
    { $limit: Number(top) },
    { $project: { _id: 0, appName: "$_id", activeTime: 1, idleTime: 1, mouseClicks: 1, keysPressed: 1 } }
  ]);

  return Respond.ok(res, { apps: rows });
};

/**
 * GET /api/logs/aggregate/titles
 */
exports.titles = async (req, res) => {
  const { deviceId, appName, from, to, top = 20 } = req.query;
  if (!deviceId || !appName) {
    return Respond.badRequest(res, "deviceId_and_appName_required", "deviceId and appName are required");
  }

  const parseDate = (v) => (!v ? null : (isFinite(v) ? new Date(Number(v)) : new Date(v)));
  const fromDate = parseDate(from) || new Date(Date.now() - 24 * 3600 * 1000);
  const toDate = parseDate(to) || new Date();

  const rows = await ActivityChunk.aggregate([
    { $match: { deviceId, endAt: { $gte: fromDate, $lte: toDate } } },
    { $unwind: "$logDetails" },
    { $match: { "logDetails.appName": appName } },
    {
      $group: {
        _id: { title: "$logDetails.title", processName: "$logDetails.processName", appName: "$logDetails.appName" },
        activeTime: { $sum: "$logDetails.activeTime" },
        idleTime: { $sum: "$logDetails.idleTime" },
        mouseMovements: { $sum: "$logDetails.mouseMovements" },
        mouseScrolls: { $sum: "$logDetails.mouseScrolls" },
        mouseClicks: { $sum: "$logDetails.mouseClicks" },
        keysPressed: { $sum: "$logDetails.keysPressed" },
        count: { $sum: 1 }
      }
    },
    { $sort: { activeTime: -1 } },
    { $limit: Number(top) },
    {
      $project: {
        _id: 0,
        title: "$_id.title",
        processName: "$_id.processName",
        appName: "$_id.appName",
        activeTime: 1,
        idleTime: 1,
        mouseMovements: 1,
        mouseScrolls: 1,
        mouseClicks: 1,
        keysPressed: 1,
        count: 1
      }
    }
  ]);

  return Respond.ok(res, { titles: rows });
};

/**
 * GET /api/logs/missing
 */
exports.missing = async (req, res) => {
  const { deviceId, from, to } = req.query;
  if (!deviceId) return Respond.badRequest(res, "deviceId_required", "deviceId is required");

  const parseDate = (v) => (!v ? null : (isFinite(v) ? new Date(Number(v)) : new Date(v)));
  const fromDate = parseDate(from) || new Date(Date.now() - 24 * 3600 * 1000);
  const toDate = parseDate(to) || new Date();

  const docs = await ActivityChunk.find(
    { deviceId, endAt: { $gte: fromDate, $lte: toDate } },
    { endAt: 1, _id: 0 }
  ).lean();

  const have = docs.map(d => d.endAt.getTime());
  return Respond.ok(res, { have }, "Existing endAt list");
};

// NEW: delete all logs
exports.deleteAllLogs = async (req, res) => {
  await ActivityChunk.deleteMany({});
  res.json({ ok: true, message: "All logs deleted" });
};
