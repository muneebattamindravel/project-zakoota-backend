// src/scripts/createAdminUser.js
//
// One-off / idempotent script to create an initial admin user in the database.
// Safe to run multiple times: if the user exists, it does nothing.
//
// Usage on server (Linux):
//   cd ~/project-zakoota-backend
//   MONGO_URI="mongodb://..." \
//   ADMIN_SEED_USERNAME=mradmin \
//   ADMIN_SEED_PASSWORD='AdminP@ss!MR' \
//   node src/scripts/createAdminUser.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

// models are in src/models, and we are in src/scripts → ../models/user
const User = require('../models/user');

async function main() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI is not set in environment variables.');
      process.exit(1);
    }

    const username = (process.env.ADMIN_SEED_USERNAME || 'admin').trim();
    const password = process.env.ADMIN_SEED_PASSWORD;

    if (!password) {
      console.error(
        '❌ ADMIN_SEED_PASSWORD is not set.\n' +
          '   Example:\n' +
          '   MONGO_URI="mongodb://..." \\\n' +
          "   ADMIN_SEED_USERNAME=admin \\\n" +
          "   ADMIN_SEED_PASSWORD='SomeStrongPassword!' \\\n" +
          '   node src/scripts/createAdminUser.js'
      );
      process.exit(1);
    }

    console.log('⏳ Connecting to MongoDB with MONGO_URI from env...');
    console.log('   (hidden for safety)');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    let user = await User.findOne({ username });

    if (user) {
      console.log(`ℹ️ User "${username}" already exists (id=${user._id})`);
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`🔐 Creating admin user "${username}"...`);

    const hash = await bcrypt.hash(password, 12);

    user = await User.create({
      username,
      passwordHash: hash,
      role: 'admin',
      isActive: true,
    });

    console.log('✅ Admin user created successfully:');
    console.log(`   username: ${username}`);
    console.log('   password: [value of ADMIN_SEED_PASSWORD used for this run]');
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
