const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const EventStaff = require('../models/EventStaff');
const Question = require('../models/Question');
const questionService = require('../services/question.service');

// Moderators: any org member (owner/admin/manager), or event staff with manage_questions.
const attachModeratorFlag = asyncHandler(async (req, res, next) => {
  if (req.membership) {
    req.isModerator = true;
    return next();
  }
  const staff = await EventStaff.findOne({
    event: req.event._id,
    user: req.user._id,
    permissions: 'manage_questions',
  });
  req.isModerator = !!staff;
  next();
});

const askQuestion = asyncHandler(async (req, res) => {
  const question = await questionService.askQuestion(req.event, req.organization._id, req.user._id, req.body.text);
  res.status(201).json({
    success: true,
    message: 'Question submitted',
    data: { question: { ...questionService.serializeQuestion(question), hasUpvoted: false, isMine: true } },
  });
});

const listQuestions = asyncHandler(async (req, res) => {
  const questions = await questionService.listQuestions(req.event, req.user._id, req.isModerator, req.query.limit);
  res.status(200).json({ success: true, data: { questions } });
});

const loadQuestion = asyncHandler(async (req, res, next) => {
  const question = await Question.findOne({ _id: req.params.questionId, event: req.event._id });
  if (!question || (question.status === 'hidden' && !req.isModerator)) {
    return next(new AppError('Question not found', 404));
  }
  req.question = question;
  next();
});

const upvote = asyncHandler(async (req, res) => {
  const question = await questionService.upvote(req.question, req.user._id);
  res.status(200).json({
    success: true,
    message: 'Upvoted',
    data: { question: { ...questionService.serializeQuestion(question), hasUpvoted: true } },
  });
});

const removeUpvote = asyncHandler(async (req, res) => {
  const question = await questionService.removeUpvote(req.question, req.user._id);
  res.status(200).json({
    success: true,
    message: 'Upvote removed',
    data: { question: { ...questionService.serializeQuestion(question), hasUpvoted: false } },
  });
});

const updateQuestionStatus = asyncHandler(async (req, res) => {
  const question = await questionService.updateStatus(req.question, req.body.status);
  res.status(200).json({
    success: true,
    message: 'Question updated',
    data: { question: questionService.serializeQuestion(question) },
  });
});

module.exports = {
  attachModeratorFlag,
  askQuestion,
  listQuestions,
  loadQuestion,
  upvote,
  removeUpvote,
  updateQuestionStatus,
};