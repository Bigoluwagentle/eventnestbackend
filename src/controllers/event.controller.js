const asyncHandler = require('../utils/asyncHandler');
const eventService = require('../services/event.service');

const createEvent = asyncHandler(async (req, res) => {
  const event = await eventService.createEvent(req.organization, req.user._id, req.body);
  res.status(201).json({ success: true, message: 'Event created', data: { event } });
});

const listOrgEvents = asyncHandler(async (req, res) => {
  const result = await eventService.listOrgEvents(req.organization._id, req.query);
  res.status(200).json({ success: true, data: result });
});

const getEvent = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { event: req.event } });
});

const updateEvent = asyncHandler(async (req, res) => {
  const event = await eventService.updateEvent(req.event, req.body);
  res.status(200).json({ success: true, message: 'Event updated', data: { event } });
});

const updateEventStatus = asyncHandler(async (req, res) => {
  const event = await eventService.updateEventStatus(req.event, req.body.status);
  res.status(200).json({ success: true, message: 'Event status updated', data: { event } });
});

const deleteEvent = asyncHandler(async (req, res) => {
  await eventService.deleteEvent(req.event);
  res.status(200).json({ success: true, message: 'Event deleted' });
});

const listPublicEvents = asyncHandler(async (req, res) => {
  const result = await eventService.listPublicEvents(req.query);
  res.status(200).json({ success: true, data: result });
});

const getPublicEvent = asyncHandler(async (req, res) => {
  const event = await eventService.getPublicEventBySlug(req.params.orgSlug, req.params.eventSlug);
  res.status(200).json({ success: true, data: { event } });
});

module.exports = {
  createEvent,
  listOrgEvents,
  getEvent,
  updateEvent,
  updateEventStatus,
  deleteEvent,
  listPublicEvents,
  getPublicEvent,
};