const mongoose = require('mongoose');
const Poll = require('../models/Poll');
const PollVote = require('../models/PollVote');
const AppError = require('../utils/AppError');
const logger = require('../config/logger');
const { getIO } = require('../sockets');

const VALID_TRANSITIONS = {
  draft: ['open'],
  open: ['closed'],
  closed: [],
};

// The public shape of a poll. Deliberately omits createdBy/organization,
// and never includes voter identities - safe to send to every attendee.
function serializePoll(poll) {
  const o = poll.toObject ? poll.toObject() : poll;
  return {
    _id: o._id,
    event: o.event,
    question: o.question,
    status: o.status,
    isAnonymous: o.isAnonymous,
    options: o.options.map((op) => ({ _id: op._id, text: op.text, voteCount: op.voteCount })),
    totalVotes: o.options.reduce((sum, op) => sum + op.voteCount, 0),
    createdAt: o.createdAt,
  };
}

function emitToEvent(eventId, eventName, payload) {
  try {
    getIO().to(`event:${eventId}`).emit(eventName, payload);
  } catch (err) {
    // socket layer unavailable - the REST action itself still succeeded
    logger.warn(`Could not emit ${eventName}: ${err.message}`);
  }
}

async function createPoll(event, organizationId, userId, { question, options, isAnonymous, openImmediately }) {
  const poll = await Poll.create({
    event: event._id,
    organization: organizationId,
    question,
    options: options.map((text) => ({ text })),
    isAnonymous,
    status: openImmediately ? 'open' : 'draft',
    createdBy: userId,
  });

  if (poll.status === 'open') {
    emitToEvent(event._id, 'poll:opened', serializePoll(poll));
  }
  return poll;
}

async function listPolls(event, userId, canSeeDrafts) {
  const filter = { event: event._id };
  if (!canSeeDrafts) filter.status = { $ne: 'draft' };

  const polls = await Poll.find(filter).sort({ createdAt: -1 });

  const votes = await PollVote.find({ user: userId, poll: { $in: polls.map((p) => p._id) } }).select('poll optionId');
  const voteMap = new Map(votes.map((v) => [v.poll.toString(), v.optionId.toString()]));

  return polls.map((p) => ({ ...serializePoll(p), myVote: voteMap.get(p._id.toString()) || null }));
}

async function getPollWithMyVote(poll, userId) {
  const vote = await PollVote.findOne({ poll: poll._id, user: userId }).select('optionId');
  return { ...serializePoll(poll), myVote: vote ? vote.optionId.toString() : null };
}

async function updatePollStatus(poll, newStatus) {
  const allowed = VALID_TRANSITIONS[poll.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(`Cannot change a poll from "${poll.status}" to "${newStatus}"`, 400);
  }

  poll.status = newStatus;
  await poll.save();

  emitToEvent(poll.event, newStatus === 'open' ? 'poll:opened' : 'poll:closed', serializePoll(poll));
  return poll;
}

async function vote(poll, userId, optionId) {
  if (poll.status !== 'open') {
    throw new AppError('This poll is not open for voting', 400);
  }
  if (!poll.options.id(optionId)) {
    throw new AppError('Invalid option for this poll', 400);
  }

  const session = await mongoose.startSession();
  let updated;

  try {
    await session.withTransaction(async () => {
      try {
        // the unique (poll, user) index rejects a second vote, even under concurrent requests
        await PollVote.create([{ poll: poll._id, event: poll.event, user: userId, optionId }], { session });
      } catch (err) {
        if (err.code === 11000) throw new AppError('You have already voted in this poll', 409);
        throw err;
      }

      // the count only moves in the same transaction as the vote record, so they can't drift apart
      updated = await Poll.findOneAndUpdate(
        { _id: poll._id, status: 'open', 'options._id': optionId },
        { $inc: { 'options.$.voteCount': 1 } },
        { new: true, session }
      );

      if (!updated) {
        throw new AppError('This poll has just been closed', 409);
      }
    });
  } finally {
    session.endSession();
  }

  const payload = serializePoll(updated);
  emitToEvent(poll.event, 'poll:updated', payload);
  return payload;
}

module.exports = { serializePoll, createPoll, listPolls, getPollWithMyVote, updatePollStatus, vote };