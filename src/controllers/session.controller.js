const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const Session = require('../models/Session');
const sessionService = require('../services/session.service');

const createSession = asyncHandler(async (req, res) => {
  const session = await sessionService.createSession(req.event, req.organization._id, req.user._id, req.body);
  res.status(201).json({ success: true, message: 'Session created', data: { session } });
});

const listSessions = asyncHandler(async (req, res) => {
  const sessions = await sessionService.listSessions(req.event._id);
  res.status(200).json({ success: true, data: { sessions } });
});

const loadSession = asyncHandler(async (req, res, next) => {
  const session = await Session.findOne({ _id: req.params.sessionId, event: req.event._id });
  if (!session) return next(new AppError('Session not found', 404));
  req.scheduleSession = session; // avoid clobbering express's own req.session
  next();
});

const updateSession = asyncHandler(async (req, res) => {
  const session = await sessionService.updateSession(req.scheduleSession, req.organization._id, req.body);
  res.status(200).json({ success: true, message: 'Session updated', data: { session } });
});

const deleteSession = asyncHandler(async (req, res) => {
  await sessionService.deleteSession(req.scheduleSession);
  res.status(200).json({ success: true, message: 'Session deleted' });
});

module.exports = { createSession, listSessions, loadSession, updateSession, deleteSession };