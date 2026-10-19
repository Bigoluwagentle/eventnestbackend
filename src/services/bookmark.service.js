const Session = require('../models/Session');
const SessionBookmark = require('../models/SessionBookmark');
const Event = require('../models/Event');
const AppError = require('../utils/AppError');
const { canAccessEvent } = require('../utils/eventParticipation');

// You can only bookmark a session of an event you are allowed to see: a published public or unlisted
// event, or any event you are part of. Anything else looks exactly like a session that doesn't exist.
async function canSeeEvent(userId, event) {
  const publiclyVisible = ['public', 'unlisted'].includes(event.visibility) && !['draft', 'cancelled'].includes(event.status);
  return publiclyVisible || canAccessEvent(userId, event._id);
}

async function addBookmark(userId, sessionId) {
  const session = await Session.findById(sessionId);
  const event = session ? await Event.findById(session.event).select('visibility status') : null;
  if (!session || !event || !(await canSeeEvent(userId, event))) {
    throw new AppError('Session not found', 404);
  }

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