const Respond = require('../utils/respond');

/**
 * API key auth for external system calls (e.g. The Matrix pulling focus data).
 * Header: x-api-key
 * Env: EXTERNAL_API_KEY — the key The Matrix must send when calling MatrixFlow.
 *
 * Note: MATRIX_API_KEY (also in .env) is a different variable — it's the key
 * MatrixFlow uses when calling The Matrix outbound. Keep them separate.
 */
module.exports = function externalApiKeyAuth(req, res, next) {
  const key = String(req.headers['x-api-key'] || '').trim();

  if (!key) {
    return Respond.unauthorized(res, 'API key required');
  }

  const validKey = process.env.EXTERNAL_API_KEY;
  if (!validKey) {
    console.error('[externalApiKeyAuth] EXTERNAL_API_KEY env var is not set');
    return Respond.error(res, 'config_error', 'External API not configured', undefined, 500);
  }

  if (key !== validKey) {
    return Respond.error(res, 'forbidden', 'Invalid API key', undefined, 403);
  }

  next();
};
