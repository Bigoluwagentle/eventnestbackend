const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const Speaker = require('../models/Speaker');
const speakerService = require('../services/speaker.service');

const createSpeaker = asyncHandler(async (req, res) => {
  const speaker = await speakerService.createSpeaker(req.organization._id, req.user._id, req.body);
  res.status(201).json({ success: true, message: 'Speaker added', data: { speaker } });
});

const listSpeakers = asyncHandler(async (req, res) => {
  const speakers = await speakerService.listSpeakers(req.organization._id);
  res.status(200).json({ success: true, data: { speakers } });
});

const loadSpeaker = asyncHandler(async (req, res, next) => {
  const speaker = await Speaker.findOne({ _id: req.params.speakerId, organization: req.organization._id });
  if (!speaker) return next(new AppError('Speaker not found', 404));
  req.speaker = speaker;
  next();
});

const updateSpeaker = asyncHandler(async (req, res) => {
  const speaker = await speakerService.updateSpeaker(req.speaker, req.body);
  res.status(200).json({ success: true, message: 'Speaker updated', data: { speaker } });
});

const deleteSpeaker = asyncHandler(async (req, res) => {
  await speakerService.deleteSpeaker(req.speaker);
  res.status(200).json({ success: true, message: 'Speaker deleted' });
});

module.exports = { createSpeaker, listSpeakers, loadSpeaker, updateSpeaker, deleteSpeaker };