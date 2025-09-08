import Config from '../models/configModel';

exports.getConfig = async (req, res) => {
  try {
    const config = await Config.findOne();
    if (!config) return res.status(404).json({ error: 'Config not found' });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

exports.updateConfig = async (req, res) => {
  try {
    const { chunkTime, idleThresholdPerChunk, screenshotRequired } = req.body;

    let config = await Config.findOne();
    if (!config) {
      config = new Config({ chunkTime, idleThresholdPerChunk, screenshotRequired });
    } else {
      config.chunkTime = chunkTime ?? config.chunkTime;
      config.idleThresholdPerChunk = idleThresholdPerChunk ?? config.idleThresholdPerChunk;
      config.screenshotRequired = screenshotRequired ?? config.screenshotRequired;
    }

    await config.save();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}