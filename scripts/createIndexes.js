require("dotenv").config();
const mongoose = require("mongoose");
const ActivityChunk = require("../src/models/activityChunk");

const MONGO = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/project-zakoota";

(async () => {
  try {
    await mongoose.connect(MONGO);
    await ActivityChunk.syncIndexes();
    console.log("✅ ActivityChunk indexes synced");
    await mongoose.connection.close();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
