// controllers/authController.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const ADMIN_USER = process.env.DASHBOARD_ADMIN_USER || "admin";
const ADMIN_PASS = process.env.DASHBOARD_ADMIN_PASSWORD || "password";
const ADMIN_PASS_HASH = process.env.DASHBOARD_ADMIN_PASS_HASH || null;

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

// Optional helper if you later want to store a hash in env
async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: "Missing username or password" });
    }

    if (username !== ADMIN_USER) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (ADMIN_PASS_HASH) {
      const ok = await verifyPassword(password, ADMIN_PASS_HASH);
      if (!ok) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
    } else {
      if (password !== ADMIN_PASS) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
    }

    const payload = {
      sub: username,
      role: "admin",
      type: "dashboard",
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.json({
      token,
      user: {
        username,
        role: "admin",
      },
    });
  } catch (err) {
    console.error("auth.login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Optional: simple token check endpoint if you ever want it
exports.me = (req, res) => {
  res.json({
    user: req.user || null,
  });
};
