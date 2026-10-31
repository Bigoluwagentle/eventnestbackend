const asyncHandler = require('../utils/asyncHandler');
const savedEventService = require('../services/savedEvent.service');

const saveEvent = asyncHandler(async (req, res) => {
  const data = await savedEventService.saveEvent(req.user._id, req.params.eventId);
  res.status(200).json({ success: true, message: 'Event saved', data });
});

const unsaveEvent = asyncHandler(async (req, res) => {
  const data = await savedEventService.unsaveEvent(req.user._id, req.params.eventId);
  res.status(200).json({ success: true, message: 'Event removed from your saved events', data });
});

const listSavedEvents = asyncHandler(async (req, res) => {
  const data = await savedEventService.listSavedEvents(req.user._id, req.query);
  res.status(200).json({ success: true, data });
});

const savedStatus = asyncHandler(async (req, res) => {
  const data = await savedEventService.savedAmong(req.user._id, req.query.eventIds);
  res.status(200).json({ success: true, data });
});

module.exports = { saveEvent, unsaveEvent, listSavedEvents, savedStatus };