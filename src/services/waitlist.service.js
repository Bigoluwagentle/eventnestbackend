const Registration = require('../models/Registration');
const Ticket = require('../models/Ticket');
const TicketType = require('../models/TicketType');
const Event = require('../models/Event');
const User = require('../models/User');
const logger = require('../config/logger');
const notificationService = require('./notification.service');
const emailService = require('./email.service');
const { inTransaction } = require('../utils/transaction');
const { generateTicketNumber } = require('../utils/ticketNumber');

const MAX_PROMOTIONS_PER_RUN = 200; // one trigger promotes at most this many; the rest wait for the next trigger
const MAX_CANDIDATES_PER_CLAIM = 100; // safety valve for the claim loop

class NothingToPromote extends Error {}

// People are only promoted while the event can still be attended and still takes registrations.
const eventAcceptsPromotions = (event) =>
  Boolean(event) && ['published', 'registration_closed'].includes(event.status) && new Date(event.endDate) > new Date();

/** 1 = first in line. Oldest first, ties broken by id. */
function waitlistPositionOf(registration) {
  // after populate('ticketType') the field holds the whole ticket type, not just its id
  const ticketTypeId = registration.ticketType && registration.ticketType._id ? registration.ticketType._id : registration.ticketType;
  return Registration.countDocuments({
    ticketType: ticketTypeId,
    status: 'waitlisted',
    $or: [
      { createdAt: { $lt: registration.createdAt } },
      { createdAt: registration.createdAt, _id: { $lte: registration._id } },
    ],
  });
}

/**
 * Finds and claims the next waiting person who can really be confirmed, and issues their ticket.
 * Runs inside the caller's transaction. Returns { registration, ticket }, or null if nobody is waiting.
 *
 * Safe against concurrent promoters: moving a registration out of "waitlisted" is ONE atomic conditional
 * update, so only one of them can win any given person.
 */
async function claimNextWaitlisted(ticketTypeId, session) {
  for (let attempt = 0; attempt < MAX_CANDIDATES_PER_CLAIM; attempt += 1) {
    const candidate = await Registration.findOne({ ticketType: ticketTypeId, status: 'waitlisted' })
      .sort({ createdAt: 1, _id: 1 })
      .session(session);
    if (!candidate) return null;

    // Someone who already holds a place for this ticket (a duplicate entry) is closed, never promoted twice.
    const alreadyHolding = await Registration.exists({
      _id: { $ne: candidate._id },
      event: candidate.event,
      user: candidate.user,
      ticketType: ticketTypeId,
      status: { $in: ['confirmed', 'pending_payment'] },
    }).session(session);
    if (alreadyHolding) {
      await Registration.updateOne(
        { _id: candidate._id, status: 'waitlisted' },
        { $set: { status: 'cancelled', cancelledAt: new Date(), cancellationReason: 'Already registered' } },
        { session }
      );
      continue;
    }

    const claimed = await Registration.findOneAndUpdate(
      { _id: candidate._id, status: 'waitlisted' },
      { $set: { status: 'confirmed' } },
      { new: true, session }
    );
    if (!claimed) continue; // another promoter just took this person: look at the next one

    const [ticket] = await Ticket.create(
      [{
        event: claimed.event,
        organization: claimed.organization,
        registration: claimed._id,
        ticketType: claimed.ticketType,
        user: claimed.user,
        ticketNumber: generateTicketNumber(),
        status: 'valid',
      }],
      { session }
    );
    return { registration: claimed, ticket };
  }
  throw new Error('Could not find anyone to promote');
}

/**
 * A confirmed attendee cancelled: hand their place straight to the next person waiting.
 * Called inside the cancellation's own transaction, so there is no moment when the place is free
 * and a newcomer could take it. Returns { registration, ticket } or null (nobody waiting, or promotions not allowed).
 */
async function handOverSlot(cancelledRegistration, session) {
  const type = await TicketType.findById(cancelledRegistration.ticketType).select('event isActive price').session(session);
  if (!type || !type.isActive || type.price !== 0) return null;

  const event = await Event.findById(type.event).select('status endDate').session(session);
  if (!eventAcceptsPromotions(event)) return null;

  return claimNextWaitlisted(cancelledRegistration.ticketType, session);
}

/** Tells a promoted person (in the app and by email). Never throws. */
async function notifyPromoted({ registration, ticket }) {
  try {
    const [event, user, ticketType] = await Promise.all([
      Event.findById(registration.event).select('name startDate timezone eventType location').lean(),
      User.findById(registration.user).select('name email').lean(),
      TicketType.findById(registration.ticketType).select('name').lean(),
    ]);
    await notificationService.createNotification(registration.user, {
      type: 'registration_confirmed',
      title: 'A place opened up: you are in!',
      message: `A place became available and you are now registered for ${event.name}.`,
      data: { eventId: String(registration.event), registrationId: String(registration._id) },
    });
    await emailService.sendRegistrationConfirmation({ user, event, ticketType, ticket, registration }); // awaited: a failure lands in the catch below
  } catch (err) {
    logger.warn(`Could not notify promoted attendee: ${err.message}`);
  }
}

/**
 * Fills any free places of a ticket type from its waiting list, oldest first. Used when the organizer
 * adds capacity or puts the ticket back on sale. Best effort: it never throws, and whatever it could
 * not do is picked up by the next cancellation or capacity change.
 */
async function promoteWaitlisted(ticketTypeId) {
  let promoted = 0;
  try {
    const type = await TicketType.findById(ticketTypeId).select('event isActive price');
    if (!type || !type.isActive || type.price !== 0) return 0;
    const event = await Event.findById(type.event).select('status endDate');
    if (!eventAcceptsPromotions(event)) return 0;

    for (; promoted < MAX_PROMOTIONS_PER_RUN; promoted += 1) {
      const next = await inTransaction(async (session) => {
        // take a free place first (atomic and conditional)...
        const slot = await TicketType.findOneAndUpdate(
          { _id: ticketTypeId, isActive: true, price: 0, $expr: { $lt: ['$quantitySold', '$quantity'] } },
          { $inc: { quantitySold: 1 } },
          { new: true, session }
        );
        if (!slot) return null;

        // ...then give it to the next person waiting. If nobody is waiting, abort: the place goes back untouched.
        const claimed = await claimNextWaitlisted(ticketTypeId, session);
        if (!claimed) throw new NothingToPromote();
        await Event.updateOne({ _id: type.event }, { $inc: { registrationCount: 1 } }, { session });
        return claimed;
      }).catch((err) => {
        if (err instanceof NothingToPromote) return null;
        throw err;
      });

      if (!next) break;
      await notifyPromoted(next);
    }
  } catch (err) {
    logger.warn(`Could not promote from the waiting list: ${err.message}`);
  }
  return promoted;
}

/** My registrations, with my place in line for the ones I'm waiting on. */
async function listMyRegistrations(userId) {
  const registrations = await Registration.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate('event', 'name slug startDate banner status')
    .populate('ticketType', 'name price currency');

  return Promise.all(
    registrations.map(async (registration) => {
      const plain = typeof registration.toJSON === 'function' ? registration.toJSON() : registration;
      return registration.status === 'waitlisted' ? { ...plain, waitlistPosition: await waitlistPositionOf(registration) } : plain;
    })
  );
}

module.exports = { waitlistPositionOf, handOverSlot, notifyPromoted, promoteWaitlisted, listMyRegistrations };