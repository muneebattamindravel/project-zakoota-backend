// src/controllers/logController.js
const Device = require("../models/device");
const ActivityChunk = require("../models/activityChunk");
const Respond = require("../utils/respond");
const { ingestBodyZ } = require("../validation/logSchemas");
const { guessAppName } = require("../utils/appNormalize");
const Config = require('../models/configModel'); // make sure you created this model

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

  // 🔹 Load config (or use defaults)
  const config = await Config.findOne();
  const chunkTime = config?.chunkTime || 60;                // seconds
  const idleThresholdPerChunk = config?.idleThresholdPerChunk || 30; // seconds
  const screenshotRequired = config?.screenshotRequired || false;

  for (const c of parsed.data.chunks) {
    try {
      const endAt = new Date(c.logClock.clientSideTimeEpochMs);
      const startAt = new Date(endAt.getTime() - chunkTime * 1000); // use DB config

      // Upsert / update device last seen
      const device = await Device.findOneAndUpdate(
        { deviceId: c.deviceId },
        {
          $setOnInsert: { deviceId: c.deviceId },
          $set: { lastSeen: now, status: "online" }
        },
        { upsert: true, new: true }
      );

      const details = (c.logDetails || []).map(d => ({
        ...d,
        appName: d.appName || guessAppName({ processName: d.processName, title: d.title || "" })
      }));

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
              userRef: { userId: device.userId || null, username: device.username || null },
              serverClientDriftMs: now.getTime() - endAt.getTime(),
              logClock: c.logClock,
              logTotals: c.logTotals,
              logDetails: details,
              // 🔹 persist config context in chunk
              configSnapshot: {
                chunkTime,
                idleThresholdPerChunk,
                screenshotRequired
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
    } catch (e) {
      console.error("ingest prepare error", e);
      results.push({
        deviceId: c.deviceId,
        endAtEpochMs: c.logClock?.clientSideTimeEpochMs,
        status: "failed",
        error: "prepare_error"
      });
    }
  }

  if (!ops.length) {
    const failed = results.filter(r => r.status === "failed").length;
    return Respond.ok(res, { results }, "Nothing to ingest", {
      inserted: 0,
      updated: 0,
      duplicates: 0,
      failed
    });
  }

  try {
    const write = await ActivityChunk.bulkWrite(ops, { ordered: false });
    const upserts = write.upsertedCount || 0;
    const modified = write.modifiedCount || 0;

    // mark result statuses
    let inserted = upserts;
    let updated = modified;
    for (let i = 0; i < results.length; i++) {
      if (results[i].status !== "pending") continue;
      if (inserted > 0) {
        results[i].status = "inserted";
        inserted--;
        continue;
      }
      if (updated > 0) {
        results[i].status = "updated";
        updated--;
        continue;
      }
      results[i].status = "duplicate";
    }

    // mark devices seen
    await Promise.all(Array.from(touchedDeviceIds).map(id => markDeviceSeen(id)));

    const duplicates = results.filter(r => r.status === "duplicate").length;
    return Respond.ok(
      res,
      { results },
      "Ingest complete",
      { inserted: upserts, updated: modified, duplicates }
    );
  } catch (e) {
    console.error("bulkWrite error", e);
    for (const r of results) if (r.status === "pending") r.status = "failed";
    const failed = results.filter(r => r.status === "failed").length;
    return Respond.error(res, "bulk_write_failed", "Ingest failed", { results, failed });
  }
};


async function markDeviceSeen(deviceId) {
  const now = new Date();
  await Device.findOneAndUpdate(
    { deviceId },
    { $set: { lastSeen: now, status: "online" } },
    { upsert: true, new: true }
  );
}

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
