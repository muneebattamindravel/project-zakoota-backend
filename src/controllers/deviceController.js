const Device = require("../models/device");
const ActivityChunk = require("../models/activityChunk");
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

exports.assign = async (req, res) => {
  const { deviceId } = req.params;
  const { username, userId } = req.body;
  if (!deviceId || (!username && !userId)) {
    return Respond.badRequest(res, 'assign_invalid', 'deviceId and one of username/userId are required');
  }
  const dev = await Device.findOneAndUpdate(
    { deviceId },
    { $set: { username: username || null, userId: userId || null } },
    { upsert: true, new: true }
  );
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await ActivityChunk.updateMany(
    { deviceId, endAt: { $gte: since } },
    { $set: { userRef: { username: username || null, userId: userId || null } } }
  );
  return Respond.ok(res, { device: dev }, 'Device assigned');
};

// NEW: delete all devices
exports.deleteAllDevices = async (req, res) => {
  await Device.deleteMany({});
  res.json({ ok: true, message: "All devices deleted" });
};