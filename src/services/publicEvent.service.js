const Event = require('../models/Event');
const TicketType = require('../models/TicketType');
const Registration = require('../models/Registration');
const AppError = require('../utils/AppError');
const { canAccessEvent } = require('../utils/eventParticipation');
const eventService = require('./event.service');

// What an attendee needs to pick and register for a ticket. Internal counters
// (quantity, quantitySold) are reduced to "remaining" and never exposed raw.
async function getPublicTicketTypes(orgSlug, eventSlug) {
  const event = await eventService.getPublicEventBySlug(orgSlug, eventSlug);
  const ticketTypes = await TicketType.find({ event: event._id, isActive: true }).sort({ price: 1 });

  // how many people are waiting for each ticket type (one query for all of them)
  const waiting = await Registration.aggregate([
    { $match: { ticketType: { $in: ticketTypes.map((t) => t._id) }, status: 'waitlisted' } },
    { $group: { _id: '$ticketType', count: { $sum: 1 } } },
  ]);
  const waitingByType = new Map(waiting.map((row) => [String(row._id), row.count]));

  const now = new Date();
  // the waiting list only exists while the event is open for registration
  const registrationOpen = event.status === 'published' && !(event.registrationDeadline && event.registrationDeadline < now);

  return ticketTypes.map((t) => {
    const remaining = Math.max(t.quantity - t.quantitySold, 0);
    const inWindow = (!t.salesStart || t.salesStart <= now) && (!t.salesEnd || t.salesEnd >= now);
    return {
      _id: t._id,
      name: t.name,
      description: t.description,
      price: t.price,
      currency: t.currency,
      remaining,
      soldOut: remaining === 0,
      onSale: inWindow && remaining > 0,
      // sold out, free, still on sale and registration open: people can join the waiting list
      waitlistOpen: registrationOpen && inWindow && remaining === 0 && t.price === 0,
      waitlistCount: waitingByType.get(String(t._id)) || 0,
      salesStart: t.salesStart,
      salesEnd: t.salesEnd,
      purchaseLimit: t.purchaseLimit,
    };
  });
}

// The virtual link is only for people who are actually part of the event:
// confirmed attendees, event staff and organization members.
async function getJoinInfo(orgSlug, eventSlug, userId) {
  const event = await eventService.getPublicEventBySlug(orgSlug, eventSlug);

  const allowed = await canAccessEvent(userId, event._id);
  if (!allowed) {
    throw new AppError('Register for this event to see how to join', 403);
  }

  const full = await Event.findById(event._id).select('eventType virtualLink');
  return { eventType: full.eventType, virtualLink: full.virtualLink };
}

module.exports = { getPublicTicketTypes, getJoinInfo };