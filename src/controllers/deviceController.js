const Device = require("../models/device");
const ActivityChunk = require("../models/activityChunk");
const Respond = require("../utils/respond");

exports.list = async (req, res) => {
  const devices = await Device.find().sort({ lastSeenAt: -1 }).lean();
  return Respond.ok(res, { devices }, "Devices fetched");
};

exports.assign = async (req, res) => {
  const { deviceId } = req.params;
  const { userId = null, username = null } = req.body || {};

  if (!deviceId) return Respond.badRequest(res, "deviceId_required", "deviceId is required");

  const dev = await Device.findOneAndUpdate(
    { deviceId },
    { $set: { userId, username } },
    { new: true, upsert: true }
  );

  // Cascade mapping to recent chunks (7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  await ActivityChunk.updateMany(
    { deviceId, endAt: { $gte: sevenDaysAgo } },
    { $set: { userRef: { userId: dev.userId, username: dev.username } } }
  );

  return Respond.ok(res, { device: dev }, "Device mapping updated");
};
