const ActivityChunk = require('../models/activityChunk');
const Respond = require('../utils/respond');

/**
 * POST /zakoota-api/external/focus
 *
 * Body:
 *   { from: ISO string, to: ISO string, userIds?: string[] }
 *
 * Returns active + idle seconds per linked Matrix userId for the given range.
 * userIds is optional — omit to return data for all linked users.
 */
exports.getFocusData = async (req, res) => {
  try {
    const { from, to, userIds } = req.body;

    if (!from || !to) {
      return Respond.badRequest(res, 'missing_params', '"from" and "to" are required');
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return Respond.badRequest(res, 'invalid_dates', '"from" and "to" must be valid ISO date strings');
    }

    if (fromDate >= toDate) {
      return Respond.badRequest(res, 'invalid_range', '"from" must be before "to"');
    }

    // Build match — only chunks with a linked Matrix userId
    const match = {
      'userRef.userId': { $exists: true, $ne: null },
      endAt: { $gte: fromDate, $lte: toDate },
    };

    if (Array.isArray(userIds) && userIds.length > 0) {
      match['userRef.userId'] = { $in: userIds.map(String) };
    }

    const rows = await ActivityChunk.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$userRef.userId',
          activeTimeSec: { $sum: '$logTotals.activeTime' },
          idleTimeSec: { $sum: '$logTotals.idleTime' },
          chunks: { $sum: 1 },
        },
      },
      { $sort: { activeTimeSec: -1 } },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          activeTimeSec: 1,
          idleTimeSec: 1,
          chunks: 1,
        },
      },
    ]);

    console.log(`[external] focus query from=${fromDate.toISOString()} to=${toDate.toISOString()} userIds=${userIds?.length ?? 'all'} → ${rows.length} result(s)`);

    return Respond.ok(res, {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      results: rows,
    }, 'Focus data fetched');
  } catch (err) {
    console.error('[external] getFocusData error:', err);
    return Respond.error(res, 'server_error', 'Failed to fetch focus data', err.message);
  }
};
