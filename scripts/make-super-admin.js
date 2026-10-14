// Promotes an existing account to platform super admin.
// Usage (from the project root):  node scripts/make-super-admin.js user@example.com
// The role is checked against the database on every request, so it applies immediately.
const mongoose = require('mongoose');
const env = require('../src/config/env');
const User = require('../src/models/User');

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: node scripts/make-super-admin.js user@example.com');
    process.exit(1);
  }

  await mongoose.connect(env.MONGO_URI);
  const user = await User.findOneAndUpdate({ email }, { $set: { role: 'super_admin' } }, { new: true });

  if (!user) {
    console.error(`No account found with the email ${email}. Sign up first, then run this again.`);
    process.exitCode = 1;
  } else {
    console.log(`${user.email} is now a super_admin.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});