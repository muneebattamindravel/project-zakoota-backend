// middleware/decryptMiddleware.js
const { isEnvelope, decryptEnvelope } = require("../utils/decrypt");

module.exports = function decryptMiddleware(req, res, next) {
  try {
    // Only decrypt if body matches envelope structure
    if (isEnvelope(req.body)) {
      const decrypted = decryptEnvelope(req.body);
      req.body = decrypted;
    }
    return next();
  } catch (err) {
    console.error("❌ Decrypt failed:", {
      route: req.originalUrl,
      reason: err.message,
    });
    return res.status(400).json({
      ok: false,
      error: "decrypt_failed",
      message: "Unable to decrypt payload",
    });
  }
};
