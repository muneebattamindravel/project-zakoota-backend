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
      profileURL: 'https://randomuser.me/api/portraits/lego/1.jpg',
      name: 'John Doe',
      designation: 'Project Manager', 
      checkInTime: "2024-09-09T09:00:00Z",
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

