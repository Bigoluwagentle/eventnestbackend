const mongoose = require('mongoose');
const Question = require('../models/Question');
const QuestionVote = require('../models/QuestionVote');
const AppError = require('../utils/AppError');
const { emitToEvent } = require('../utils/realtime');

const MAX_QUESTIONS_PER_USER = 10;
const CLOSED_EVENT_STATUSES = ['draft', 'cancelled', 'completed'];

// Shape sent to everyone in the event room. No author - attendees can't see who asked.
function serializeQuestion(q) {
  return {
    _id: q._id,
    event: q.event,
    text: q.text,
    status: q.status,
    upvoteCount: q.upvoteCount,
    createdAt: q.createdAt,
  };
}

async function askQuestion(event, organizationId, userId, text) {
  if (CLOSED_EVENT_STATUSES.includes(event.status)) {
    throw new AppError('Questions are closed for this event', 400);
  }

  const asked = await Question.countDocuments({ event: event._id, author: userId });
  if (asked >= MAX_QUESTIONS_PER_USER) {
    throw new AppError(`You can ask at most ${MAX_QUESTIONS_PER_USER} questions per event`, 429);
  }

  const question = await Question.create({
    event: event._id,
    organization: organizationId,
    author: userId,
    text,
  });

  emitToEvent(event._id, 'question:new', serializeQuestion(question));
  return question;
}

async function listQuestions(event, userId, isModerator, limit) {
  const filter = { event: event._id };
  if (!isModerator) filter.status = { $in: ['approved', 'answered'] };

  let query = Question.find(filter).sort({ upvoteCount: -1, createdAt: -1 }).limit(limit);
  if (isModerator) query = query.populate('author', 'name');
  const questions = await query;

  const votes = await QuestionVote.find({
    user: userId,
    question: { $in: questions.map((q) => q._id) },
  }).select('question');
  const upvoted = new Set(votes.map((v) => v.question.toString()));

  return questions.map((q) => {
    const authorId = (q.author._id || q.author).toString();
    const item = {
      ...serializeQuestion(q),
      hasUpvoted: upvoted.has(q._id.toString()),
      isMine: authorId === userId.toString(),
    };
    if (isModerator) item.author = { _id: authorId, name: q.author.name };
    return item;
  });
}

async function upvote(question, userId) {
  if (question.status === 'hidden') {
    throw new AppError('Cannot upvote a hidden question', 400);
  }

  const session = await mongoose.startSession();
  let updated;

  try {
    await session.withTransaction(async () => {
      try {
        // the unique (question, user) index rejects a second upvote, even under concurrent requests
        await QuestionVote.create([{ question: question._id, user: userId }], { session });
      } catch (err) {
        if (err.code === 11000) throw new AppError('You have already upvoted this question', 409);
        throw err;
      }

      updated = await Question.findOneAndUpdate(
        { _id: question._id, status: { $ne: 'hidden' } },
        { $inc: { upvoteCount: 1 } },
        { new: true, session }
      );

      if (!updated) {
        throw new AppError('This question is no longer available', 409);
      }
    });
  } finally {
    session.endSession();
  }

  emitToEvent(question.event, 'question:updated', serializeQuestion(updated));
  return updated;
}

async function removeUpvote(question, userId) {
  const session = await mongoose.startSession();
  let updated;

  try {
    await session.withTransaction(async () => {
      const deleted = await QuestionVote.findOneAndDelete({ question: question._id, user: userId }, { session });
      if (!deleted) {
        throw new AppError('You have not upvoted this question', 404);
      }

      updated = await Question.findByIdAndUpdate(
        question._id,
        { $inc: { upvoteCount: -1 } },
        { new: true, session }
      );
    });
  } finally {
    session.endSession();
  }

  emitToEvent(question.event, 'question:updated', serializeQuestion(updated));
  return updated;
}

async function updateStatus(question, newStatus) {
  question.status = newStatus;
  await question.save();

  // a hidden question's text must not leak to people already in the room
  const payload =
    newStatus === 'hidden'
      ? { _id: question._id, event: question.event, status: 'hidden' }
      : serializeQuestion(question);
  emitToEvent(question.event, 'question:updated', payload);

  return question;
}

module.exports = { serializeQuestion, askQuestion, listQuestions, upvote, removeUpvote, updateStatus };