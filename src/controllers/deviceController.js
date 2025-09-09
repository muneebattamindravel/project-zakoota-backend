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