console.log("-------------------------------")
console.log("***** Z A K O O T A v 1.0 *****")
console.log("-------------------------------")
console.log(new Date().toISOString())
console.log("-------------------------------");

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 666;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Routes ---
// routes
const authRoutes = require("./routes/auth");
const deviceRoutes = require("./routes/devices");
const logRoutes = require("./routes/logs");

app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/logs", logRoutes);

// global error handler (keeps response shape)
const Respond = require("./utils/respond");
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    return Respond.error(res, "unhandled_error", err.message || "Internal error");
});

app.get("/health", (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
});

// --- MongoDB connection ---
console.log("✅ Connecting to MongoDB...");

mongoose
    .connect(process.env.MONGO_URI)
    .then((conn) => {
        console.log("✅ MongoDB connected:", conn.connection.host);

        // Start server after DB is ready
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 API running on http://0.0.0.0:${PORT}`);
        });


        // Graceful shutdown
        process.on("SIGINT", async () => {
            console.log("🛑 SIGINT received: shutting down..");
            server.close(() => console.log("✅ HTTP server closed"));

            await mongoose.connection.close();
            console.log("✅ MongoDB connection closed");

            process.exit(0);
        });
    })
    .catch((err) => {
        console.error("❌ MongoDB connection error:", err.message);
        process.exit(1);
    });


// --- Export app (useful for testing) ---
module.exports = app;
//This is obviously a file change
