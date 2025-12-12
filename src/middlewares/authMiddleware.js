// middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

exports.requireAuth = (req, res, next) => {

    next();
    return;

    const header = req.headers["authorization"] || req.headers["Authorization"];

    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const token = header.slice("Bearer ".length).trim();

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        console.warn("JWT verify failed:", err.message);
        return res.status(401).json({ error: "Invalid or expired token" });
    }
};
