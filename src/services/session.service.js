const Session = require('../models/Session');
const SessionBookmark = require('../models/SessionBookmark');
const Speaker = require('../models/Speaker');
const AppError = require('../utils/AppError');
const { notifyScheduleChange } = require('./eventNotifier.service');

async function validateSpeakersBelongToOrg(speakerIds, organizationId) {
  if (!speakerIds || speakerIds.length === 0) return;
  const count = await Speaker.countDocuments({ _id: { $in: speakerIds }, organization: organizationId });
  if (count !== speakerIds.length) {
    throw new AppError('One or more speakers are invalid for this organization', 400);
  }
}

async function createSession(event, organizationId, userId, data) {
  await validateSpeakersBelongToOrg(data.speakers, organizationId);

  if (data.startTime < event.startDate || data.endTime > event.endDate) {
    throw new AppError("Session time must fall within the event's start and end dates", 400);
  }

  return Session.create({ ...data, event: event._id, organization: organizationId, createdBy: userId });
}

async function listSessions(eventId) {
  return Session.find({ event: eventId }).sort({ startTime: 1 }).populate('speakers', 'name photo company jobTitle');
}

async function updateSession(event, session, organizationId, updates) {
  if (updates.speakers) {
    await validateSpeakersBelongToOrg(updates.speakers, organizationId);
  }

  // times are checked as they will be AFTER the update, and only when a time is actually being changed
  // (so renaming a session never fails just because the event's dates moved since it was created)
  if (updates.startTime || updates.endTime) {
    const startTime = updates.startTime || session.startTime;
    const endTime = updates.endTime || session.endTime;
    if (endTime <= startTime) {
      throw new AppError('Session end time must be after start time', 400);
    }
    if (startTime < event.startDate || endTime > event.endDate) {
      throw new AppError("Session time must fall within the event's start and end dates", 400);
    }
  }

  const before = { start: +session.startTime, end: +session.endTime, location: session.location };
  Object.assign(session, updates);
  await session.save();

  // people who bookmarked this session hear about a change of time or place
  const timeChanged = before.start !== +session.startTime || before.end !== +session.endTime;
  const placeChanged = before.location !== session.location;
  if (timeChanged || placeChanged) {
    await notifyScheduleChange(session, { timeChanged, placeChanged });
  }

  return session;
}

async function deleteSession(session) {
  await session.deleteOne();
  // the notifier looks bookmarks up, so they are removed only afterwards (no bookmark is left pointing at nothing)
  await notifyScheduleChange(session, { removed: true });
  await SessionBookmark.deleteMany({ session: session._id });
}

module.exports = { createSession, listSessions, updateSession, deleteSession };