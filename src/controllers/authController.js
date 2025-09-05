const bcrypt = require("bcrypt");
const User = require("../models/user");
const Respond = require("../utils/respond");

exports.login = async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return Respond.badRequest(res, "missing_credentials", "Username and password are required");
  }

  const user = await User.findOne({ username }).lean();
  if (!user) return Respond.unauthorized(res, "Invalid credentials", "invalid_credentials");

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return Respond.unauthorized(res, "Invalid credentials", "invalid_credentials");

  // MVP: no token; FE treats { ok:true } as logged in
  return Respond.ok(res, { user: { username: user.username } }, "Login successful");
};

// NEW: register user
exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return Respond.error(res, "validation_error", "Username and password required");
    }
    const existing = await User.findOne({ username });
    if (existing) {
      return Respond.error(res, "conflict", "User already exists");
    }
    const user = new User({ username, password });
    await user.save();
    return Respond.success(res, { user });
  } catch (err) {
    return Respond.error(res, "server_error", err.message);
  }
};