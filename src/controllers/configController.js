const Config = require('../models/config');

exports.getUserConfig = async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const config = await Config.findOne();
    if (!config) return res.status(404).json({ error: 'Config not found' });

    const device = await Device.findOne({ deviceId });

    let userInfo = {};
    if (device) {
      userInfo = {
        profileURL: device.profileURL || 'https://randomuser.me/api/portraits/lego/1.jpg',
        name: device.name || 'Unnamed User',
        designation: device.designation || 'N/A',
        checkInTime: device.checkInTime || null,
      };
    }

    res.json({
      data: {
        ...config.toObject(),
        ...userInfo,
      },
    });
  } catch (err) {
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

