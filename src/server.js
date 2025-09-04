console.log("-------------------------------");
console.log("***** Z A K O O T A v1.0 *****");
console.log("-------------------------------");
console.log(new Date().toISOString());
console.log("-------------------------------");

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const Respond = require("./utils/respond");

const app = express();
const PORT = process.env.PORT || 666;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Routes ---
const authRoutes = require("./routes/auth");
const deviceRoutes = require("./routes/devices");
const logRoutes = require("./routes/logs");

app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/logs", logRoutes);

// --- Health route ---
app.get("/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// --- Global error handler ---
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  return Respond.error(res, "unhandled_error", err.message || "Internal error");
});

// --- MongoDB connection + Server startup ---
async function startServer() {
  try {


    console.log('✅ Connecting to Mongo');
    // ✅ Connect to MongoDB and start server
    mongoose.connect(process.env.MONGO_URI)
      .then(() => {
        console.log('✅ MongoDB connected');
        const PORT = process.env.PORT || 6666;
        app.listen(PORT, () =>
          console.log(`🚀 Server running on port ${PORT}`)
        );
      })


    // console.log("✅ Connecting to MongoDB...");
    // mongoose.set("strictQuery", true);

    // const conn = await mongoose.connect(process.env.MONGO_URI, {
    //   serverSelectionTimeoutMS: 10000, // fail fast if DB not reachable
    // });

    // console.log("✅ MongoDB connected:", conn.connection.host);

    // const server = app.listen(PORT, "0.0.0.0", () => {
    //   console.log(`🚀 API running on http://0.0.0.0:${PORT}`);
    // });

    // --- Graceful shutdown ---
    const shutdown = async (signal) => {
      console.log(`🛑 ${signal} received: shutting down..`);
      server.close(() => console.log("✅ HTTP server closed"));
      await mongoose.connection.close();
      console.log("✅ MongoDB connection closed");
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));


  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
}

startServer();

// --- Export app (useful for testing) ---
module.exports = app;
