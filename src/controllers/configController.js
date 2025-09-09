const Config = require('../models/config');

exports.getUserConfig = async (req, res) => {
  try {
    const { deviceId } = req.body;

    const config = await Config.findOne();
    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }

    let userInfo = {
      profileURL: null,
      name: null,
      designation: null,
      checkInTime: null,
    };

    if (deviceId) {
      const device = await Device.findOne({ deviceId });
      if (device) {
        userInfo = {
          profileURL: device.profileURL || null,
          name: device.name || null,
          designation: device.designation || null,
          checkInTime: device.checkInTime || null,
        };
      }
    }

    res.json({
      data: {
        ...config.toObject(),
        ...userInfo,
      },
    });
  } catch (err) {
    console.error("getUserConfig error:", err);
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

