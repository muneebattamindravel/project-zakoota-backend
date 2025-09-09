const Config = require('../models/config');

exports.getUserConfig = async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const config = await Config.findOne();
    if (!config) return res.status(404).json({ error: 'Config not found' });

    // For now, mock user info. Later link to matrix system
    const mockUser = {
      userProfileImageURL: 'https://randomuser.me/api/portraits/lego/1.jpg',
      userName: 'John Doe',
    };

    res.json({
      data: {
        ...config.toObject(),
        ...mockUser,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const { chunkTime, idleThresholdPerChunk, screenshotRequired } = req.body;

    let config = await Config.findOne();
    if (!config) {
      config = new Config({ chunkTime, idleThresholdPerChunk, screenshotRequired });
    } else {
      if (chunkTime !== undefined) config.chunkTime = chunkTime;
      if (idleThresholdPerChunk !== undefined) config.idleThresholdPerChunk = idleThresholdPerChunk;
      if (screenshotRequired !== undefined) config.screenshotRequired = screenshotRequired;
    }

    await config.save();
    res.json({ data: config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
