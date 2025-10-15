// utils/cryptoKey.js
const crypto = require("crypto");

// Derive or parse a 32-byte AES key from the env secret
function makeAesKeyFromSecret(secret) {
  function isProbablyBase64(s) {
    return typeof s === "string" && /^[A-Za-z0-9+/=]+$/.test(s) && s.length % 4 === 0;
  }

  if (typeof secret === "string") {
    try {
      // base64 32-byte key
      if (isProbablyBase64(secret)) {
        const raw = Buffer.from(secret, "base64");
        if (raw.length === 32) return raw;
      }
      // hex 32-byte key
      if (/^[0-9a-fA-F]+$/.test(secret) && secret.length === 64) {
        return Buffer.from(secret, "hex");
      }
    } catch (_) {}
  }

  // default deterministic scrypt-derived key
  return crypto.scryptSync(String(secret || ""), "zakoota-static-salt", 32);
}

const SECRET = process.env.ZAKOOTA_SECRET;
const AES_KEY = makeAesKeyFromSecret(SECRET);

module.exports = AES_KEY;
