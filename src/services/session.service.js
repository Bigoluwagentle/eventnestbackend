const Session = require('../models/Session');
const Speaker = require('../models/Speaker');
const AppError = require('../utils/AppError');

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

async function updateSession(session, organizationId, updates) {
  if (updates.speakers) {
    await validateSpeakersBelongToOrg(updates.speakers, organizationId);
  }
  Object.assign(session, updates);
  await session.save();
  return session;
}

async function deleteSession(session) {
  await session.deleteOne();
}

module.exports = { createSession, listSessions, updateSession, deleteSession };