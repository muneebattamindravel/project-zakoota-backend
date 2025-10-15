// utils/decrypt.js
const crypto = require("crypto");
const AES_KEY = require("./cryptoKey");

function isEnvelope(obj) {
  return (
    obj &&
    typeof obj === "object" &&
    obj.v === 1 &&
    obj.alg === "aes-256-gcm" &&
    typeof obj.iv === "string" &&
    typeof obj.tag === "string" &&
    typeof obj.ct === "string"
  );
}

/**
 * Decrypt AES-256-GCM envelope to JSON object
 * @throws if invalid or tampered
 */
function decryptEnvelope(envelope) {
  const iv = Buffer.from(envelope.iv, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  const ct = Buffer.from(envelope.ct, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", AES_KEY, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}

module.exports = { isEnvelope, decryptEnvelope };
