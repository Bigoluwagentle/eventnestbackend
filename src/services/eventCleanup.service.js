const mongoose = require('mongoose');
const Event = require('../models/Event');
const TicketType = require('../models/TicketType');
const Session = require('../models/Session');
const SessionBookmark = require('../models/SessionBookmark');
const Poll = require('../models/Poll');
const PollVote = require('../models/PollVote');
const Question = require('../models/Question');
const QuestionVote = require('../models/QuestionVote');
const Announcement = require('../models/Announcement');
const GalleryItem = require('../models/GalleryItem');
const EventStaff = require('../models/EventStaff');
const Registration = require('../models/Registration');
const AppError = require('../utils/AppError');
const logger = require('../config/logger');
const { cloudinary, isConfigured } = require('../config/cloudinary');

const ROOT = 'eventnest';

// Hosted files cannot join a database transaction, so they are removed afterwards, in batches of 100,
// and only ever from our own folder tree. A failure here is logged, never fatal: the event is already gone.
async function removeHostedImages(publicIds) {
  const ours = publicIds.filter((id) => typeof id === 'string' && id.startsWith(`${ROOT}/`));
  if (!ours.length || !isConfigured) return;

  for (let start = 0; start < ours.length; start += 100) {
    try {
      await cloudinary.api.delete_resources(ours.slice(start, start + 100), { resource_type: 'image', type: 'upload', invalidate: true });
    } catch (err) {
      logger.warn(`Could not delete hosted event images: ${err?.message || JSON.stringify(err)}`);
    }
  }
}

/**
 * Deletes a draft event together with everything that hangs off it, in ONE transaction, so a failure
 * halfway cannot leave a half-deleted event. Events that ever had registrations are refused.
 */
async function deleteEventCascade(event) {
  if (await Registration.exists({ event: event._id })) {
    throw new AppError('This event has registrations and cannot be deleted. Cancel it instead.', 400);
  }

  // collected before the transaction removes the records that name them
  const photos = await GalleryItem.find({ event: event._id, type: 'photo' }).select('photo.publicId').lean();
  const hostedImages = photos.map((item) => item.photo && item.photo.publicId);
  if (event.banner && event.banner.publicId) hostedImages.push(event.banner.publicId);

  const session = await mongoose.startSession();
  try {
    // operations inside one transaction run one after another; the event itself goes last
    await session.withTransaction(async () => {
      const questions = await Question.find({ event: event._id }).select('_id').session(session).lean();
      await QuestionVote.deleteMany({ question: { $in: questions.map((q) => q._id) } }, { session });
      await Question.deleteMany({ event: event._id }, { session });
      await PollVote.deleteMany({ event: event._id }, { session });
      await Poll.deleteMany({ event: event._id }, { session });
      await SessionBookmark.deleteMany({ event: event._id }, { session });
      await Session.deleteMany({ event: event._id }, { session });
      await Announcement.deleteMany({ event: event._id }, { session });
      await GalleryItem.deleteMany({ event: event._id }, { session });
      await EventStaff.deleteMany({ event: event._id }, { session });
      await TicketType.deleteMany({ event: event._id }, { session });
      await Event.deleteOne({ _id: event._id }, { session });
    });
  } finally {
    session.endSession();
  }

  await removeHostedImages(hostedImages);
}

module.exports = { deleteEventCascade };