const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Session = require('../models/session');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'; // e.g. '10m', '1h'

// Simple parser for '10m', '1h', '30s', '1d'
function expiresInToMs(str) {
  if (typeof str === 'number') return str * 1000;
  const match = /^(\d+)([smhd])$/.exec(String(str).trim());
  if (!match) {
    // default 1 hour
    return 60 * 60 * 1000;
  }
  const num = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return num * 1000;
    case 'm':
      return num * 60 * 1000;
    case 'h':
      return num * 60 * 60 * 1000;
    case 'd':
      return num * 24 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
}

const expiresMs = expiresInToMs(JWT_EXPIRES_IN);

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username or password' });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const now = Date.now();
    const expiresAt = new Date(now + expiresMs);

    const session = await Session.create({
      user: user._id,
      userAgent: req.headers['user-agent'] || '',
      ip:
        req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
        req.connection.remoteAddress ||
        '',
      expiresAt,
    });

    const payload = {
      sub: user._id.toString(),
      sid: session._id.toString(),
      role: user.role,
      type: 'dashboard',
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    user.lastLoginAt = new Date();
    await user.save();

    res.json({
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('auth.login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.logout = async (req, res) => {
  try {
    const session = req.session;
    if (!session) {
      return res.status(200).json({ ok: true });
    }

    if (!session.revokedAt) {
      session.revokedAt = new Date();
      session.revokedReason = 'User logout';
      await session.save();
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('auth.logout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.me = async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.json({
    user: {
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      lastLoginAt: user.lastLoginAt,
    },
  });
};

exports.listSessions = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const sessions = await Session.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    res.json({
      sessions: sessions.map((s) => ({
        id: s._id.toString(),
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        revokedAt: s.revokedAt,
        ip: s.ip,
        userAgent: s.userAgent,
      })),
    });
  } catch (err) {
    console.error('auth.listSessions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
