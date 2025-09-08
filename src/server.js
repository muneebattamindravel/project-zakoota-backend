require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const Respond = require("./utils/respond");

// ---- Config
const API_PREFIX  = process.env.API_PREFIX || "/zakoota-api";
const PORT        = Number(process.env.PORT || 6666);
const MONGO_URI   = process.env.MONGO_URI;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

console.log("-------------------------------");
console.log("***** Z A K O O T A  v1.0 *****");
console.log("-------------------------------");
console.log(new Date().toISOString());
console.log("-------------------------------");

const app = express();

// ---- Security & basics
app.use(helmet());
// app.use(cors({ origin: CORS_ORIGIN === "*" ? true : [CORS_ORIGIN], credentials: false }));
app.use(cors({ origin: "*" }));

app.use(express.json({ limit: "2mb" }));
app.use(morgan("combined"));

// ---- Rate limits
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
const apiLimiter  = rateLimit({ windowMs: 60 * 1000, max: 600 });

// ---- Routes (keep your existing route files)
const authRoutes   = require("./routes/auth");
const deviceRoutes = require("./routes/devices");
const logRoutes    = require("./routes/logs");
const configRoutes    = require("./routes/config");

// Mount under /zakoota-api/*
app.use(`${API_PREFIX}/auth`,    authLimiter, authRoutes);
app.use(`${API_PREFIX}/devices`, apiLimiter,  deviceRoutes);
app.use(`${API_PREFIX}/logs`,    apiLimiter,  logRoutes);
app.use(`${API_PREFIX}/config`,    apiLimiter,  configRoutes);

app.use('/zakoota-api/config', configRoutes);

// Health
app.get(`${API_PREFIX}/health`, (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Global error handler (uses your Respond helper)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  return Respond.error(res, "unhandled_error", err.message || "Internal error");
});

// ---- Startup / shutdown
let server;
async function start() {
  try {
    if (!MONGO_URI) throw new Error("MONGO_URI not set");
    console.log("✅ Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected");

    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Listening on http://0.0.0.0:${PORT}${API_PREFIX}`);
      console.log(`🩺 Health: GET ${API_PREFIX}/health`);
    });
  } catch (e) {
    console.error("❌ Startup error:", e);
    process.exit(1);
  }
}
start();

async function shutdown(sig) {
  try {
    console.log(`🛑 ${sig} received: shutting down...`);
    if (server) await new Promise((res) => server.close(res));
    await mongoose.connection.close();
    console.log("✅ Clean shutdown complete");
  } finally {
    process.exit(0);
  }
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

module.exports = app;
