const mongoose = require('mongoose');

// Runs work(session) inside a database transaction and returns its result. If the work throws, nothing
// it wrote is kept. (The driver can run the callback again after a transient error, so keep side effects
// that are not database writes OUT of it.)
async function inTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    session.endSession();
  }
}

module.exports = { inTransaction };