const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Session = require('../models/session');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';

exports.requireAuth = async (req, res, next) => {
  try {
    const header = req.headers['authorization'] || req.headers['Authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = header.slice('Bearer '.length).trim();
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const sessionId = payload.sid;
    const userId = payload.sub;

    if (!sessionId || !userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Session not found' });
    }

    if (session.revokedAt) {
      return res.status(401).json({ error: 'Session revoked' });
    }

    if (session.expiresAt <= new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const user = await User.findById(session.user);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User disabled or not found' });
    }

    // Attach to request
    req.user = user;
    req.session = session;

    next();
  } catch (err) {
    console.error('requireAuth error:', err);
    res.status(500).json({ error: 'Internal auth error' });
  }
};
