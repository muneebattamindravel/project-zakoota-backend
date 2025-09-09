const Config = require('../models/config');
const Device = require('../models/device');

exports.getUserConfig = async (req, res) => {
  try {
    const { deviceId } = req.body || {}; // ✅ handles undefined body

    const config = await Config.findOne();
    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }

    // Default fallback user info
    let userInfo = {
      profileURL: 'https://randomuser.me/api/portraits/lego/1.jpg',
      name: 'John Doe',
      designation: 'Project Manager',
      checkInTime: '2024-09-09T09:00:00Z',
    };

    // Case: deviceId provided and non-empty
    if (deviceId && String(deviceId).trim() !== '') {
      const device = await Device.findOne({ deviceId: String(deviceId).trim() });
      if (device) {
        // Case: device found → use device info
        userInfo = {
          profileURL: device.profileURL || userInfo.profileURL,
          name: device.name || userInfo.name,
          designation: device.designation || userInfo.designation,
          checkInTime: device.checkInTime || userInfo.checkInTime,
        };
      }
      // else → keep default userInfo
    }
    // else → no deviceId → keep default userInfo

    res.json({
      data: {
        ...config.toObject(),
        ...userInfo,
      },
    });
  } catch (err) {
    console.error('getUserConfig error:', err);
    res.status(500).json({ error: err.message });
  }
};



exports.updateConfig = async (req, res) => {
  try {
    const { chunkTime, idleThresholdPerChunk, isZaiminaarEnabled } = req.body;

    let config = await Config.findOne();
    if (!config) {
      config = new Config({ chunkTime, idleThresholdPerChunk, isZaiminaarEnabled });
    } else {
      if (chunkTime !== undefined) config.chunkTime = chunkTime;
      if (idleThresholdPerChunk !== undefined) config.idleThresholdPerChunk = idleThresholdPerChunk;
      if (isZaiminaarEnabled !== undefined) config.isZaiminaarEnabled = isZaiminaarEnabled;
    }

    await config.save();
    res.json({ data: config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

