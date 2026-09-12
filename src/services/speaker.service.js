const Speaker = require('../models/Speaker');
const Session = require('../models/Session');
const AppError = require('../utils/AppError');

async function createSpeaker(organizationId, userId, data) {
  return Speaker.create({ ...data, organization: organizationId, createdBy: userId });
}

async function listSpeakers(organizationId) {
  return Speaker.find({ organization: organizationId }).sort({ name: 1 });
}

async function updateSpeaker(speaker, updates) {
  Object.assign(speaker, updates);
  await speaker.save();
  return speaker;
}

async function deleteSpeaker(speaker) {
  const usedInSession = await Session.findOne({ speakers: speaker._id });
  if (usedInSession) {
    throw new AppError('Cannot delete a speaker who is assigned to a session. Remove them from sessions first.', 400);
  }
  await speaker.deleteOne();
}

module.exports = { createSpeaker, listSpeakers, updateSpeaker, deleteSpeaker };