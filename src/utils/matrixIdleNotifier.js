/**
 * matrixIdleNotifier.js
 *
 * IDEMPOTENT idle tracking — works correctly whether a chunk is inserted, updated, or duplicate.
 *
 * Model:
 *   - On each chunk, we look at activeTime / idleTime totals.
 *   - If activeTime > 0 → reset idleStreakStartAt and notification flag.
 *   - If fully idle and no idleStreakStartAt → bootstrap it to chunkStartAt.
 *   - stretchSeconds = chunkEndAt - idleStreakStartAt (computed, not accumulated).
 *   - If stretch >= threshold → notify Matrix once, set lastMatrixIdleNotifiedAt.
 *
 * Because the stretch is COMPUTED from timestamps (not $inc'd), processing the same
 * chunk twice gives the same result. Safe for both inserted and updated chunks.
 */

const Device = require('../models/device');

const MATRIX_BASE_URL = 'https://matrix.mindravel.com';
const DEFAULT_IDLE_THRESHOLD_SECONDS = 300;

async function processIdleNotifications(chunksWithStatus, chunkTime, matrixIdleThresholdSeconds) {
  const threshold = matrixIdleThresholdSeconds || DEFAULT_IDLE_THRESHOLD_SECONDS;

  for (const chunk of chunksWithStatus) {
    try {
      const { deviceId, logTotals, logClock, _ingestStatus } = chunk;
      const idleTime   = Number(logTotals?.idleTime   ?? 0);
      const activeTime = Number(logTotals?.activeTime ?? 0);
      const chunkEndAt = new Date(logClock.clientSideTimeEpochMs);
      const chunkStartAt = new Date(chunkEndAt.getTime() - chunkTime * 1000);

      // ---- ACTIVE CHUNK: reset everything
      if (activeTime > 0) {
        await Device.updateOne(
          { deviceId },
          {
            $set: { currentIdleStretchSeconds: 0 },
            $unset: { idleStreakStartAt: '', lastMatrixIdleNotifiedAt: '' },
          }
        );
        console.log(`[chunk] ${deviceId} (${_ingestStatus}, active: ${activeTime}s, idle: ${idleTime}s) → ACTIVE → reset idle streak`);
        continue;
      }

      // ---- FULLY IDLE CHUNK: compute stretch from idleStreakStartAt
      const device = await Device.findOne({ deviceId }).lean();
      if (!device) {
        console.log(`[chunk] ${deviceId} (${_ingestStatus}, idle: ${idleTime}s) → device not found in DB, skipping`);
        continue;
      }

      // Bootstrap idleStreakStartAt if missing — anchor it to this chunk's start
      let streakStart = device.idleStreakStartAt ? new Date(device.idleStreakStartAt) : null;
      if (!streakStart || streakStart > chunkStartAt) {
        streakStart = chunkStartAt;
        await Device.updateOne({ deviceId }, { $set: { idleStreakStartAt: streakStart } });
      }

      const stretchSeconds = Math.max(0, Math.floor((chunkEndAt.getTime() - streakStart.getTime()) / 1000));
      await Device.updateOne({ deviceId }, { $set: { currentIdleStretchSeconds: stretchSeconds } });

      console.log(`[chunk] ${deviceId} (${_ingestStatus}, idle: ${idleTime}s) → IDLE → stretch: ${stretchSeconds}s / threshold: ${threshold}s (streakStart: ${streakStart.toISOString()})`);

      // Already notified in this idle streak
      if (device.lastMatrixIdleNotifiedAt) {
        console.log(`[chunk] ${deviceId} → already notified Matrix at ${new Date(device.lastMatrixIdleNotifiedAt).toISOString()}, skipping`);
        continue;
      }

      // Below threshold
      if (stretchSeconds < threshold) {
        console.log(`[chunk] ${deviceId} → below threshold (${stretchSeconds}s < ${threshold}s), waiting...`);
        continue;
      }

      // Not linked to Matrix
      if (!device.userId) {
        console.log(`[chunk] ${deviceId} → threshold crossed but device not linked to a Matrix user, skipping`);
        continue;
      }

      const idleMinutes = Math.round(stretchSeconds / 60);
      console.log(`[chunk] ${deviceId} → calling Matrix stop-idle API (userId: ${device.userId}, idleMinutes: ${idleMinutes})...`);

      await _callMatrixStopIdle({
        userId: device.userId,
        idleMinutes,
        detectedAt: chunkEndAt.toISOString(),
      });

      await Device.updateOne({ deviceId }, { $set: { lastMatrixIdleNotifiedAt: new Date() } });

      console.log(`[chunk] ${deviceId} → ✅ Matrix notified (userId: ${device.userId}, stretch: ${stretchSeconds}s, idleMinutes: ${idleMinutes})`);
    } catch (err) {
      console.error(`[chunk] ${chunk?.deviceId} → ❌ Error: ${err.message}`);
    }
  }
}

async function _callMatrixStopIdle({ userId, idleMinutes, detectedAt }) {
  const apiKey = process.env.MATRIX_API_KEY;
  if (!apiKey) throw new Error('MATRIX_API_KEY is not configured');

  const res = await fetch(`${MATRIX_BASE_URL}/external-service/timers/stop-idle`, {
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
