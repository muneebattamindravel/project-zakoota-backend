// scripts/create-user.js
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../src/models/user");

const { MONGO_URI } = process.env;

async function main() {
  const [,, username, password] = process.argv;
  if (!username || !password) {
    console.error("Usage: node scripts/create-user.js <username> <password>");
    process.exit(1);
  }

  if (!MONGO_URI) {
    console.error("MONGO_URI not set in .env");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await User.findOne({ username });
  if (existing) {
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(`✅ Updated password for user: ${username}`);
  } else {
    await User.create({ username, passwordHash });
    console.log(`✅ Created user: ${username}`);
  }

  await mongoose.connection.close();
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
