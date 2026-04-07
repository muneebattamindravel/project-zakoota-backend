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
 * @param {Array}  chunksWithStatus             - all chunks from ingest, each with a `_ingestStatus` field ('inserted'|'updated'|'duplicate')
 * @param {number} chunkTime                    - seconds per chunk
 * @param {number} matrixIdleThresholdSeconds   - consecutive idle seconds before notifying Matrix
 */
async function processIdleNotifications(chunksWithStatus, chunkTime, matrixIdleThresholdSeconds) {
  const threshold = matrixIdleThresholdSeconds || DEFAULT_IDLE_THRESHOLD_SECONDS;

  for (const chunk of chunksWithStatus) {
    try {
      const { deviceId, logTotals, logClock, _ingestStatus } = chunk;
      const idleTime   = Number(logTotals?.idleTime   ?? 0);
      const activeTime = Number(logTotals?.activeTime ?? 0);
      const endAt = new Date(logClock.clientSideTimeEpochMs);

      // For duplicate/updated chunks: log and skip idle logic (already processed)
      if (_ingestStatus !== 'inserted') {
        console.log(`[chunk] ${deviceId} — ${_ingestStatus.toUpperCase()} (active: ${activeTime}s, idle: ${idleTime}s) → skipping idle logic`);
        continue;
      }

      const isActiveChunk = activeTime > 0; // any activity at all breaks the idle streak

      if (isActiveChunk) {
        const prev = await Device.findOneAndUpdate(
          { deviceId },
          { $set: { currentIdleStretchSeconds: 0 }, $unset: { lastMatrixIdleNotifiedAt: '' } },
          { new: false }
        ).lean();
        console.log(`[chunk] ${deviceId} — INSERTED, ACTIVE (active: ${activeTime}s, idle: ${idleTime}s) → idle stretch reset (was ${prev?.currentIdleStretchSeconds ?? 0}s)`);
        continue;
      }

      // Idle chunk — atomically accumulate
      const updated = await Device.findOneAndUpdate(
        { deviceId },
        { $inc: { currentIdleStretchSeconds: idleTime } },
        { new: true }
      ).lean();

      if (!updated) {
        console.log(`[chunk] ${deviceId} — INSERTED, IDLE (idle: ${idleTime}s) → device not found in DB, skipping`);
        continue;
      }

      const stretch = updated.currentIdleStretchSeconds;
      console.log(`[chunk] ${deviceId} — INSERTED, IDLE (idle: ${idleTime}s) → stretch: ${stretch}s / threshold: ${threshold}s`);

      if (updated.lastMatrixIdleNotifiedAt) {
        console.log(`[chunk] ${deviceId} → already notified Matrix at ${updated.lastMatrixIdleNotifiedAt.toISOString()}, skipping`);
        continue;
      }

      if (stretch < threshold) {
        console.log(`[chunk] ${deviceId} → below threshold, waiting...`);
        continue;
      }

      if (!updated.userId) {
        console.log(`[chunk] ${deviceId} → threshold crossed but not linked to a Matrix user, skipping`);
        continue;
      }

      const idleMinutes = Math.round(stretch / 60);
      console.log(`[chunk] ${deviceId} → calling Matrix stop-idle (userId: ${updated.userId}, idleMinutes: ${idleMinutes})...`);

      await _callMatrixStopIdle({
        userId: updated.userId,
        idleMinutes,
        detectedAt: endAt.toISOString(),
      });

      await Device.updateOne({ deviceId }, { $set: { lastMatrixIdleNotifiedAt: new Date() } });

      console.log(`[chunk] ${deviceId} → ✅ Matrix notified (userId: ${updated.userId}, idleStretch: ${stretch}s, idleMinutes: ${idleMinutes})`);
    } catch (err) {
      console.error(`[chunk] ${chunk?.deviceId} → ❌ Error: ${err.message}`);
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
