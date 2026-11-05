const Registration = require('../models/Registration');
const Ticket = require('../models/Ticket');
const TicketType = require('../models/TicketType');
const Event = require('../models/Event');
const AppError = require('../utils/AppError');
const logger = require('../config/logger');
const { generateTicketToken } = require('../utils/ticketToken');
const { generateTicketNumber } = require('../utils/ticketNumber');
const { assertEventAllowsRegistration } = require('../utils/registrationRules');
const { inTransaction } = require('../utils/transaction');
const notificationService = require('./notification.service');
const emailService = require('./email.service');
const { waitlistPositionOf, handOverSlot, notifyPromoted } = require('./waitlist.service');

/**
 * Registers a user for a ticket type. When the ticket type is sold out and `joinWaitlist` is true, a FREE
 * ticket puts the person on the waiting list instead (no inventory is touched and no ticket is issued).
 */
async function registerForEvent(event, ticketType, user, { joinWaitlist = false } = {}) {
  if (event.status !== 'published') {
    throw new AppError('This event is not open for registration', 400);
  }
  await assertEventAllowsRegistration(event, user);
  if (event.registrationDeadline && event.registrationDeadline < new Date()) {
    throw new AppError('Registration deadline has passed', 400);
  }
  if (!ticketType.isActive) {
    throw new AppError('This ticket type is not currently available', 400);
  }

  const now = new Date();
  if (ticketType.salesStart && ticketType.salesStart > now) {
    throw new AppError('Ticket sales have not started yet', 400);
  }
  if (ticketType.salesEnd && ticketType.salesEnd < now) {
    throw new AppError('Ticket sales have ended', 400);
  }

  const existing = await Registration.findOne({
    event: event._id,
    user: user._id,
    ticketType: ticketType._id,
    status: { $in: ['pending_payment', 'confirmed', 'waitlisted'] },
  });
  if (existing) {
    throw new AppError('You already have a registration for this ticket type', 409);
  }

  const isFree = ticketType.price === 0;
  let registration;
  let ticket;
  let qrToken;
  let queued = false;

  await inTransaction(async (session) => {
    // the callback can be retried by the driver, so start from a clean slate each time
    registration = undefined;
    ticket = undefined;
    qrToken = undefined;
    queued = false;

    // THE oversell guard: atomic conditional increment. Succeeds only if quantitySold is still below
    // quantity at the exact moment of the write - no race window even under concurrent requests.
    const updatedTicketType = await TicketType.findOneAndUpdate(
      { _id: ticketType._id, $expr: { $lt: ['$quantitySold', '$quantity'] } },
      { $inc: { quantitySold: 1 } },
      { new: true, session }
    );

    if (!updatedTicketType) {
      // sold out. Only free tickets have a waiting list, and only for people who asked to join it.
      if (!(joinWaitlist && isFree)) {
        throw new AppError('This ticket type is sold out', 409, { canJoinWaitlist: isFree });
      }
      const [waiting] = await Registration.create(
        [{ event: event._id, organization: event.organization, user: user._id, ticketType: ticketType._id, quantity: 1, status: 'waitlisted', amountDue: 0 }],
        { session }
      );
      registration = waiting;
      queued = true;
      return;
    }

    const [createdRegistration] = await Registration.create(
      [
        {
          event: event._id,
          organization: event.organization,
          user: user._id,
          ticketType: ticketType._id,
          quantity: 1,
          status: isFree ? 'confirmed' : 'pending_payment',
          amountDue: ticketType.price,
        },
      ],
      { session }
    );
    registration = createdRegistration;

    // popularity counter, kept in the same transaction as the inventory so the two can never disagree
    await Event.updateOne({ _id: event._id }, { $inc: { registrationCount: 1 } }, { session });

    // Free tickets issue immediately. Paid tickets wait for payment confirmation.
    if (isFree) {
      const [createdTicket] = await Ticket.create(
        [
          {
            event: event._id,
            organization: event.organization,
            registration: registration._id,
            ticketType: ticketType._id,
            user: user._id,
            ticketNumber: generateTicketNumber(),
            status: 'valid',
          },
        ],
        { session }
      );
      ticket = createdTicket;
      qrToken = generateTicketToken(ticket._id);
    }
  });

  if (queued) {
    return { registration, ticket: undefined, qrToken: undefined, waitlistPosition: await waitlistPositionOf(registration) };
  }

  if (ticket) {
    // confirmation: in-app notification + email. Neither can fail the registration.
    notificationService
      .createNotification(user._id, {
        type: 'registration_confirmed',
        title: 'Registration confirmed',
        message: `You're registered for ${event.name}.`,
        data: { eventId: event._id.toString(), registrationId: registration._id.toString() },
      })
      .catch((err) => logger.warn(`Could not create registration notification: ${err.message}`));

    emailService.sendRegistrationConfirmation({ user, event, ticketType, ticket, registration });
  }

  return { registration, ticket, qrToken };
}

/**
 * Cancels a registration. A confirmed or pending attendee's place goes straight to the next person on the
 * waiting list inside the SAME transaction, so there is never a moment when the place is free and a
 * newcomer could take it ahead of the queue. Leaving the waiting list changes no inventory.
 */
async function cancelRegistration(registration, ticket) {
  if (registration.status === 'cancelled') {
    throw new AppError('Registration is already cancelled', 400);
  }

  // people on the waiting list never held a place
  const heldPlace = ['confirmed', 'pending_payment'].includes(registration.status);
  let promotion = null;

  await inTransaction(async (session) => {
    promotion = null; // the callback can be retried

    registration.status = 'cancelled';
    registration.cancelledAt = new Date();
    await registration.save({ session });

    if (ticket && ticket.status === 'valid') {
      ticket.status = 'cancelled';
      await ticket.save({ session });
    }

    if (heldPlace) {
      promotion = await handOverSlot(registration, session);
      if (!promotion) {
        // nobody to give it to: free up the inventory place and the popularity count
        await TicketType.findByIdAndUpdate(registration.ticketType, { $inc: { quantitySold: -1 } }, { session });
        await Event.updateOne({ _id: registration.event }, { $inc: { registrationCount: -1 } }, { session });
      }
    }
  });

  if (promotion) await notifyPromoted(promotion);

  return registration;
}

module.exports = { registerForEvent, cancelRegistration, generateTicketNumber };