
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user');

async function main() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI is not set in .env');
      process.exit(1);
    }

    const username =
      process.env.ADMIN_SEED_USERNAME?.trim() || 'admin';
    const password = process.env.ADMIN_SEED_PASSWORD;

    if (!password) {
      console.error(
        '❌ ADMIN_SEED_PASSWORD is not set. Example:\n' +
          "   ADMIN_SEED_USERNAME=admin ADMIN_SEED_PASSWORD='SuperSecure123!' node scripts/createAdminUser.js"
      );
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected');

    let user = await User.findOne({ username });

    if (user) {
      console.log(`ℹ️ User "${username}" already exists (id=${user._id})`);
      process.exit(0);
    }

    console.log(`Creating admin user "${username}"...`);

    const hash = await bcrypt.hash(password, 12);

    user = await User.create({
      username,
      passwordHash: hash,
      role: 'admin',
      isActive: true,
    });

    console.log('✅ Admin user created successfully:');
    console.log(`   username: ${username}`);
    console.log('   password: [the one you just used in ADMIN_SEED_PASSWORD]');
    console.log(`   id:       ${user._id.toString()}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

main();
