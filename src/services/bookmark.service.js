const Session = require('../models/Session');
const SessionBookmark = require('../models/SessionBookmark');
const AppError = require('../utils/AppError');

async function addBookmark(userId, sessionId) {
  const session = await Session.findById(sessionId);
  if (!session) throw new AppError('Session not found', 404);

  const existing = await SessionBookmark.findOne({ user: userId, session: sessionId });
  if (existing) throw new AppError('Session already bookmarked', 409);

  return SessionBookmark.create({ user: userId, session: sessionId, event: session.event });
}

async function removeBookmark(userId, sessionId) {
  const result = await SessionBookmark.findOneAndDelete({ user: userId, session: sessionId });
  if (!result) throw new AppError('Bookmark not found', 404);
}

async function listMyAgenda(userId, eventId) {
  return SessionBookmark.find({ user: userId, event: eventId })
    .populate({
      path: 'session',
      populate: { path: 'speakers', select: 'name photo company jobTitle' },
    })
    .sort({ createdAt: 1 });
}

module.exports = { addBookmark, removeBookmark, listMyAgenda };