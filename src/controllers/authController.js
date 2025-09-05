const bcrypt = require("bcrypt");
const User = require("../models/user");
const Respond = require("../utils/respond");

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return Respond.badRequest(
        res,
        "missing_credentials",
        "Username and password are required"
      );
    }

    const user = await User.findOne({ username });
    if (!user) {
      return Respond.unauthorized(
        res,
        "invalid_credentials",
        "Invalid username or password"
      );
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return Respond.unauthorized(
        res,
        "invalid_credentials",
        "Invalid username or password"
      );
    }

    // ✅ Return only safe fields
    return Respond.ok(
      res,
      { user: { id: user._id, username: user.username } },
      "Login successful"
    );
  } catch (err) {
    console.error("❌ Login error:", err);
    return Respond.error(res, "server_error", err.message || "Internal server error");
  }
};


// Register user with hashed password
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

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ username, passwordHash });
    await user.save();

    return Respond.success(res, {
      user: { id: user._id, username: user.username }
    });
  } catch (err) {
    return Respond.error(res, "server_error", err.message || "Internal server error");
  }
};