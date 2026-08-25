const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const Event = require('../models/Event');

/**
 * Loads an event scoped to req.organization (set by the tenant middleware).
 * Must run after loadOrganization + requireMembership.
 * Guarantees the event actually belongs to this org - the core cross-tenant guard for events.
 */
const loadEvent = asyncHandler(async (req, res, next) => {
  const { eventId } = req.params;

  const event = await Event.findOne({ _id: eventId, organization: req.organization._id });

  if (!event) {
    return next(new AppError('Event not found', 404));
  }

  req.event = event;
  next();
});

module.exports = { loadEvent };