require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../src/models/user");

const MONGO = process.env.MONGO_URI;

(async () => {
  try {
    await mongoose.connect(MONGO);
    const username = process.argv[2] || "admin";
    const password = process.argv[3] || "admin123";
    const hash = await bcrypt.hash(password, 10);
    await User.findOneAndUpdate(
      { username },
      { $set: { passwordHash: hash } },
      { upsert: true }
    );
    console.log(`✅ Seeded user "${username}"`);
    await mongoose.connection.close();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
