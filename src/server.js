console.log("***** Z A K O O T A A *****")
console.log(new Date().toISOString())

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
        const server = app.listen(PORT, () => {
            console.log(`🚀 API running on http://localhost:${PORT}`);
        });

        // Graceful shutdown
        process.on("SIGINT", async () => {
            console.log("🛑 SIGINT received: shutting down...");
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
