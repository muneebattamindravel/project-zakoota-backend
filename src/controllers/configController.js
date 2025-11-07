const Config = require('../models/config');
const Device = require('../models/device');

exports.getUserConfig = async (req, res) => {
  try {
    const { deviceId } = req.body;
    const config = await Config.findOne();
    if (!config) return res.status(404).json({ error: 'Config not found' });

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
      } else {
        userInfo = {
          profileURL: 'https://randomuser.me/api/portraits/lego/1.jpg',
          name: 'John Doe',
          designation: 'Project Manager',
          checkInTime: '2024-09-09T09:00:00Z',
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
    console.error('getUserConfig error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const { chunkTime, idleThresholdPerChunk, isZaiminaarEnabled, clientHeartbeatDelay, serviceHeartbeatDelay, allowQuit } = req.body;

    let config = await Config.findOne();
    if (!config) {
      config = new Config({
        chunkTime,
        idleThresholdPerChunk,
        isZaiminaarEnabled,
        clientHeartbeatDelay,
        serviceHeartbeatDelay,
        allowQuit,
        version: 1, // first version
      });
    } else {
      if (chunkTime !== undefined) config.chunkTime = chunkTime;
      if (idleThresholdPerChunk !== undefined) config.idleThresholdPerChunk = idleThresholdPerChunk;
      if (isZaiminaarEnabled !== undefined) config.isZaiminaarEnabled = isZaiminaarEnabled;
      if (clientHeartbeatDelay !== undefined) config.clientHeartbeatDelay = clientHeartbeatDelay;
      if (serviceHeartbeatDelay !== undefined) config.serviceHeartbeatDelay = serviceHeartbeatDelay;

      // bump version automatically
      config.version = (config.version || 0) + 1;
    }

    await config.save();
    res.json({ data: config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
