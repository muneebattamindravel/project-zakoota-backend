/**
 * matrixIdleNotifier.js
 *
 * Tracks consecutive idle time across chunks per device.
 * Notifies Matrix once when the accumulated idle stretch >= threshold.
 * Resets everything when an active chunk arrives.
 *
 * Example with threshold=70s, chunkTime=60s:
 *   chunk 1: idle=58s → stretch=58s  (< 70, no notify)
 *   chunk 2: idle=60s → stretch=118s (>= 70, notify once)
 *   chunk 3: idle=59s → stretch stays (already notified, skip)
 *   chunk 4: active   → stretch=0, notifiedAt cleared
 *   chunk 5: idle=60s → stretch=60s  (fresh stretch, no notify yet)
 *   chunk 6: idle=61s → stretch=121s (>= 70, notify again)
 */

const Device = require('../models/device');

const MATRIX_BASE_URL = 'https://matrix.mindravel.com';
const DEFAULT_IDLE_THRESHOLD_SECONDS = 300;

/**
 * @param {Array}  chunks                    - newly inserted chunks from ingest
 * @param {number} chunkTime                 - seconds per chunk (unused for threshold, kept for context)
 * @param {number} matrixIdleThresholdSeconds - consecutive idle seconds before notifying Matrix
 */
async function processIdleNotifications(chunks, chunkTime, matrixIdleThresholdSeconds) {
  const threshold = matrixIdleThresholdSeconds || DEFAULT_IDLE_THRESHOLD_SECONDS;

  for (const chunk of chunks) {
    try {
      const { deviceId, logTotals, logClock } = chunk;
      const idleTime  = Number(logTotals?.idleTime  ?? 0);
      const activeTime = Number(logTotals?.activeTime ?? 0);
      const endAt = new Date(logClock.clientSideTimeEpochMs);

      const isActiveChunk = activeTime > 0; // any activity at all breaks the idle streak

      if (isActiveChunk) {
        // Device was active — reset consecutive idle stretch and notification flag
        await Device.findOneAndUpdate(
          { deviceId },
          { $set: { currentIdleStretchSeconds: 0 }, $unset: { lastMatrixIdleNotifiedAt: '' } },
          { new: false }
        ).lean();
        continue;
      }

      // Idle chunk — atomically accumulate
      const updated = await Device.findOneAndUpdate(
        { deviceId },
        { $inc: { currentIdleStretchSeconds: idleTime } },
        { new: true }
      ).lean();

      if (!updated) continue;

      const stretch = updated.currentIdleStretchSeconds;

      console.log(`[matrixIdleNotifier] ${deviceId} — idle stretch: ${stretch}s / threshold: ${threshold}s`);

      // Already notified for this idle stretch
      if (updated.lastMatrixIdleNotifiedAt) continue;

      // Threshold not yet crossed
      if (stretch < threshold) continue;

      // Must be linked to a Matrix user
      if (!updated.userId) continue;

      const idleMinutes = Math.round(stretch / 60);

      await _callMatrixStopIdle({
        userId: updated.userId,
        idleMinutes,
        detectedAt: endAt.toISOString(),
      });

      await Device.updateOne({ deviceId }, { $set: { lastMatrixIdleNotifiedAt: new Date() } });

      console.log(
        `[matrixIdleNotifier] ✅ Notified Matrix — device: ${deviceId}, userId: ${updated.userId}, idleStretch: ${stretch}s, idleMinutes: ${idleMinutes}`
      );
    } catch (err) {
      console.error(`[matrixIdleNotifier] ❌ Error for ${chunk?.deviceId}: ${err.message}`);
    }
  }
}

async function _callMatrixStopIdle({ userId, idleMinutes, detectedAt }) {
  const apiKey = process.env.MATRIX_API_KEY;
  if (!apiKey) throw new Error('MATRIX_API_KEY is not configured');

  const res = await fetch(`${MATRIX_BASE_URL}/dev/external-service/timers/stop-idle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      source: 'MatrixFlow',
      detectedAt,
      items: [{ userId, idleMinutes }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Matrix API responded ${res.status}: ${body}`);
  }

  return res.json();
}

module.exports = { processIdleNotifications };
