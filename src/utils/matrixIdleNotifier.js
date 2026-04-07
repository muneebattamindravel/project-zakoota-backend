/**
 * matrixIdleNotifier.js
 *
 * Detects when a device has been idle for >= 5 minutes and notifies the Matrix
 * backend once per idle stretch. Re-fires only after the device has had an
 * active chunk (meaning a new idle stretch has started).
 *
 * Anti-spam guarantee:
 *   - Device.lastMatrixIdleNotifiedAt is set when we fire.
 *   - Subsequent idle chunks for the same stretch are skipped
 *     (lastMatrixIdleNotifiedAt >= chunk.startAt).
 *   - An active chunk resets lastMatrixIdleNotifiedAt so the next idle
 *     stretch triggers a fresh notification.
 */

const Device = require('../models/device');

const MATRIX_BASE_URL = 'https://matrix.mindravel.com';
const DEFAULT_IDLE_THRESHOLD_SECONDS = 300; // fallback: 5 minutes

/**
 * Call after bulkWrite in logController.ingest.
 * Pass only newly-inserted chunks (status === "inserted") to avoid
 * re-processing duplicates.
 *
 * Fire-and-forget: caller should NOT await this.
 *
 * @param {Array} chunks - raw chunk objects from parsed.data.chunks
 * @param {number} chunkTime - seconds per chunk from config (default 300)
 * @param {number} matrixIdleThresholdSeconds - idle seconds before notifying Matrix (configurable)
 */
async function processIdleNotifications(chunks, chunkTime, matrixIdleThresholdSeconds) {
  const windowSeconds = chunkTime || DEFAULT_IDLE_THRESHOLD_SECONDS;

  // Cap the threshold at windowSeconds — a chunk can never have more idle
  // time than its own duration, so a threshold higher than chunkTime would
  // never fire.
  const configuredThreshold = matrixIdleThresholdSeconds || DEFAULT_IDLE_THRESHOLD_SECONDS;
  const effectiveThreshold = Math.min(configuredThreshold, windowSeconds);

  console.log(
    `[matrixIdleNotifier] Processing ${chunks.length} chunk(s) — chunkTime: ${windowSeconds}s, threshold: ${effectiveThreshold}s (configured: ${configuredThreshold}s)`
  );

  for (const chunk of chunks) {
    try {
      const { deviceId, logTotals, logClock } = chunk;
      const idleTime = Number(logTotals?.idleTime ?? 0);
      const activeTime = Number(logTotals?.activeTime ?? 0);

      const endAt = new Date(logClock.clientSideTimeEpochMs);
      const startAt = new Date(endAt.getTime() - windowSeconds * 1000);

      const device = await Device.findOne({ deviceId }).lean();
      if (!device) {
        console.log(`[matrixIdleNotifier] Device not found: ${deviceId}`);
        continue;
      }

      const isActive = activeTime > idleTime;

      if (isActive) {
        // Device was active this chunk — reset so next idle stretch fires again
        if (device.lastMatrixIdleNotifiedAt) {
          await Device.updateOne({ deviceId }, { $unset: { lastMatrixIdleNotifiedAt: '' } });
          console.log(`[matrixIdleNotifier] Reset idle state for active device: ${deviceId}`);
        }
        continue;
      }

      const isIdle = idleTime >= effectiveThreshold;

      console.log(
        `[matrixIdleNotifier] ${deviceId} — idle: ${idleTime}s, active: ${activeTime}s, threshold: ${effectiveThreshold}s, qualifies: ${isIdle}`
      );

      if (!isIdle) continue;

      // Already notified for this idle stretch?
      const alreadyNotified =
        device.lastMatrixIdleNotifiedAt &&
        new Date(device.lastMatrixIdleNotifiedAt) >= startAt;

      if (alreadyNotified) {
        console.log(`[matrixIdleNotifier] Already notified for this idle stretch: ${deviceId}`);
        continue;
      }

      // Device must be linked to a Matrix user
      if (!device.userId) {
        console.log(`[matrixIdleNotifier] Skipped — device not linked to Matrix user: ${deviceId}`);
        continue;
      }

      const idleMinutes = Math.round(idleTime / 60);

      await _callMatrixStopIdle({
        userId: device.userId,
        idleMinutes,
        detectedAt: endAt.toISOString(),
      });

      await Device.updateOne({ deviceId }, { $set: { lastMatrixIdleNotifiedAt: new Date() } });

      console.log(
        `[matrixIdleNotifier] ✅ Notified Matrix — device: ${deviceId}, userId: ${device.userId}, idleMinutes: ${idleMinutes}`
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
