// One-off: sets Event.registrationCount from the registrations that already exist, so events created
// before this field existed start with the right number. Safe to run again at any time (it sets exact
// values, it never adds).
//
// Usage, from the project root:   node scripts/backfill-registration-counts.js
const mongoose = require('mongoose');

// People holding a place: confirmed or waiting to pay. Waiting-list entries and cancellations do not count.
async function recount(Registration, Event) {
  const counts = await Registration.aggregate([
    { $match: { status: { $in: ['confirmed', 'pending_payment'] } } },
    { $group: { _id: '$event', count: { $sum: 1 } } },
  ]);

  // every event first (including ones with no registrations and ones created before the field existed)...
  await Event.updateMany({}, { $set: { registrationCount: 0 } });
  // ...then the real numbers
  if (counts.length) {
    await Event.bulkWrite(counts.map(({ _id, count }) => ({ updateOne: { filter: { _id }, update: { $set: { registrationCount: count } } } })));
  }
  return counts.length;
}

async function main() {
  const env = require('../src/config/env');
  const Registration = require('../src/models/Registration');
  const Event = require('../src/models/Event');

  await mongoose.connect(env.MONGO_URI);
  const withRegistrations = await recount(Registration, Event);
  console.log(`Done. ${withRegistrations} event(s) have registrations; every other event is set to 0.`);
  await mongoose.disconnect();
}

module.exports = { recount };

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}