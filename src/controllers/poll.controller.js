const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const Poll = require('../models/Poll');
const pollService = require('../services/poll.service');

const createPoll = asyncHandler(async (req, res) => {
  const poll = await pollService.createPoll(req.event, req.organization._id, req.user._id, req.body);
  res.status(201).json({ success: true, message: 'Poll created', data: { poll: pollService.serializePoll(poll) } });
});

const listPolls = asyncHandler(async (req, res) => {
  // org members can see drafts; everyone else only sees open/closed polls
  const canSeeDrafts = !!req.membership;
  const polls = await pollService.listPolls(req.event, req.user._id, canSeeDrafts);
  res.status(200).json({ success: true, data: { polls } });
});

const loadPoll = asyncHandler(async (req, res, next) => {
  const poll = await Poll.findOne({ _id: req.params.pollId, event: req.event._id });
  if (!poll || (poll.status === 'draft' && !req.membership)) {
    return next(new AppError('Poll not found', 404));
  }
  req.poll = poll;
  next();
});

const getPoll = asyncHandler(async (req, res) => {
  const poll = await pollService.getPollWithMyVote(req.poll, req.user._id);
  res.status(200).json({ success: true, data: { poll } });
});

const updatePollStatus = asyncHandler(async (req, res) => {
  const poll = await pollService.updatePollStatus(req.poll, req.body.status);
  res.status(200).json({ success: true, message: 'Poll updated', data: { poll: pollService.serializePoll(poll) } });
});

const vote = asyncHandler(async (req, res) => {
  const poll = await pollService.vote(req.poll, req.user._id, req.body.optionId);
  res.status(200).json({ success: true, message: 'Vote recorded', data: { poll } });
});

module.exports = { createPoll, listPolls, loadPoll, getPoll, updatePollStatus, vote };