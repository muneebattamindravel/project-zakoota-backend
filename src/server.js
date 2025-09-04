// -------------------------------
// ***** Z A K O O T A  v1.0 *****
// -------------------------------
console.log("-------------------------------");
console.log("***** Z A K O O T A v1.0 *****");
console.log("-------------------------------");
console.log(new Date().toISOString());
console.log("-------------------------------");

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Respond = require("./utils/respond");

// Config
const API_PREFIX = process.env.API_PREFIX || "/zakoota-api";
const PORT = Number(process.env.PORT || 6666);
const MONGO_URI = process.env.MONGO_URI;

const app = express();

// --- Middleware ---
app.use(cors());               // adjust to { origin: [...], credentials: true } if needed
app.use(express.json());

// --- Routes ---
const authRoutes   = require("./routes/auth");
const deviceRoutes = require("./routes/devices");
const logRoutes    = require("./routes/logs");

// Mount all API routes under /zakoota-api/*
app.use(`${API_PREFIX}/auth`,   authRoutes);
app.use(`${API_PREFIX}/devices`, deviceRoutes);
app.use(`${API_PREFIX}/logs`,    logRoutes);

// --- Health route (under /zakoota-api/health) ---
app.get(`${API_PREFIX}/health`, (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// --- Global error handler ---
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  return Respond.error(res, "unhandled_error", err.message || "Internal error");
});

// --- MongoDB connection + Server startup ---
let server;
async function startServer() {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is not set");
    }

    console.log("✅ Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected");

    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
      console.log(`🔗 API base: ${API_PREFIX}`);
      console.log(`🩺 Health:   GET ${API_PREFIX}/health`);
    });
  } catch (err) {
    console.error("❌ Startup error:", err.message);
    process.exit(1);
  }
}

// --- Graceful shutdown ---
async function shutdown(signal) {
  try {
    console.log(`🛑 ${signal} received: shutting down...`);
    if (server) {
      await new Promise((res) => server.close(res));
      console.log("✅ HTTP server closed");
    }
    await mongoose.connection.close();
    console.log("✅ MongoDB connection closed");
  } catch (e) {
    console.error("⚠️ Error during shutdown:", e);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();

// --- Export app (for testing) ---
module.exports = app;
