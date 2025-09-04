/**
 * Unified API response helper.
 * Shape:
 *  - success:
 *      { ok: true, message, data?, meta? }
 *  - error:
 *      { ok: false, message, error, details?, meta? }
 */
class Respond {
  static ok(res, data = {}, message = "OK", meta = undefined, status = 200) {
    const body = { ok: true, message };
    if (data !== undefined) body.data = data;
    if (meta !== undefined) body.meta = meta;
    return res.status(status).json(body);
  }

  static created(res, data = {}, message = "Created", meta = undefined) {
    return this.ok(res, data, message, meta, 201);
  }

  static paginated(res, data = [], meta = { total: 0, limit: 0, skip: 0 }, message = "OK") {
    return this.ok(res, data, message, meta, 200);
  }

  static badRequest(res, error = "bad_request", message = "Bad request", details = undefined) {
    const body = { ok: false, message, error };
    if (details) body.details = details;
    return res.status(400).json(body);
  }

  static unauthorized(res, message = "Unauthorized", error = "unauthorized") {
    return res.status(401).json({ ok: false, message, error });
  }

  static notFound(res, message = "Not found", error = "not_found") {
    return res.status(404).json({ ok: false, message, error });
  }

  static error(res, error = "server_error", message = "Something went wrong", details = undefined, status = 500) {
    const body = { ok: false, message, error };
    if (details) body.details = details;
    return res.status(status).json(body);
  }
}

module.exports = Respond;
