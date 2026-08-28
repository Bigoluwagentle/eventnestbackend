const mongoose = require('mongoose');
const crypto = require('crypto');
const TicketType = require('../models/TicketType');
const Registration = require('../models/Registration');
const Ticket = require('../models/Ticket');
const AppError = require('../utils/AppError');
const { generateTicketToken } = require('../utils/ticketToken');

function generateTicketNumber() {
  // human-friendly display reference only - NOT used for security/validation
  return `ENT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

async function registerForEvent(event, ticketType, user) {
  if (event.status !== 'published') {
    throw new AppError('This event is not open for registration', 400);
  }
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

  const session = await mongoose.startSession();
  let registration;
  let ticket;
  let qrToken;

  try {
    await session.withTransaction(async () => {
      // THE oversell guard: atomic conditional increment. Succeeds only if
      // quantitySold is still below quantity at the exact moment of the write -
      // no race window even under concurrent requests.
      const updatedTicketType = await TicketType.findOneAndUpdate(
        { _id: ticketType._id, $expr: { $lt: ['$quantitySold', '$quantity'] } },
        { $inc: { quantitySold: 1 } },
        { new: true, session }
      );

      if (!updatedTicketType) {
        throw new AppError('This ticket type is sold out', 409);
      }

      const isFree = ticketType.price === 0;

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

      // Free tickets issue immediately. Paid tickets wait for payment
      // confirmation - that flow gets built in Phase 8.
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
  } finally {
    session.endSession();
  }

  return { registration, ticket, qrToken };
}

async function cancelRegistration(registration, ticket) {
  if (registration.status === 'cancelled') {
    throw new AppError('Registration is already cancelled', 400);
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      registration.status = 'cancelled';
      registration.cancelledAt = new Date();
      await registration.save({ session });

      if (ticket && ticket.status === 'valid') {
        ticket.status = 'cancelled';
        await ticket.save({ session });
      }

      // free up the inventory slot
      await TicketType.findByIdAndUpdate(registration.ticketType, { $inc: { quantitySold: -1 } }, { session });
    });
  } finally {
    session.endSession();
  }

  return registration;
}

module.exports = { registerForEvent, cancelRegistration, generateTicketNumber };