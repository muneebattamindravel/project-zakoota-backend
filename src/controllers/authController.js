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
