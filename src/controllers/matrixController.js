const Device = require('../models/device');
const Respond = require('../utils/respond');

const MATRIX_BASE_URL = 'https://matrix.mindravel.com';
const MATRIX_USERS_PATH = '/external-service/users';

async function fetchMatrixUsers() {
  const apiKey = process.env.MATRIX_API_KEY;
  if (!apiKey) throw new Error('MATRIX_API_KEY is not configured');

  const res = await fetch(`${MATRIX_BASE_URL}${MATRIX_USERS_PATH}`, {
    headers: { 'x-api-key': apiKey },
  });

  if (!res.ok) {
    throw new Error(`Matrix API responded with ${res.status}`);
  }

  const body = await res.json();
  return body?.data?.items ?? [];
}

exports.getUsers = async (req, res) => {
  try {
    const users = await fetchMatrixUsers();
    return Respond.ok(res, users, 'Matrix users fetched');
  } catch (err) {
    console.error('matrixController.getUsers error:', err);
    return Respond.error(res, 'matrix_error', 'Failed to fetch Matrix users', err.message);
  }
};

exports.linkDevice = async (req, res) => {
  try {
    const { deviceId, matrixUserId } = req.body;
    if (!deviceId || !matrixUserId) {
      return res.status(400).json({ error: 'deviceId and matrixUserId are required' });
    }

    const users = await fetchMatrixUsers();
    const matrixUser = users.find((u) => u.userId === matrixUserId);
    if (!matrixUser) {
      return res.status(404).json({ error: 'Matrix user not found' });
    }

    const device = await Device.findOneAndUpdate(
      { deviceId },
      {
        $set: {
          userId: matrixUser.userId,
          name: matrixUser.name || undefined,
          username: matrixUser.username || undefined,
          designation: matrixUser.designation || undefined,
        },
      },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    return Respond.ok(res, { device, matrixUser }, 'Device linked to Matrix user');
  } catch (err) {
    console.error('matrixController.linkDevice error:', err);
    return Respond.error(res, 'matrix_error', 'Failed to link device', err.message);
  }
};
