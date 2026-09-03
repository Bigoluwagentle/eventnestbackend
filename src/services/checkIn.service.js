const Ticket = require('../models/Ticket');
const AppError = require('../utils/AppError');
const { verifyTicketToken } = require('../utils/ticketToken');

async function checkInTicket(event, ticketId, token, staffUserId) {
  if (!verifyTicketToken(ticketId, token)) {
    throw new AppError('Invalid ticket. This QR code could not be verified.', 400);
  }

  const ticket = await Ticket.findOne({ _id: ticketId, event: event._id });

  if (!ticket) {
    throw new AppError('This ticket does not belong to this event.', 404);
  }

  if (ticket.status === 'cancelled') throw new AppError('This ticket has been cancelled.', 400);
  if (ticket.status === 'refunded') throw new AppError('This ticket has been refunded.', 400);

  if (ticket.status === 'used') {
    const when = ticket.checkedInAt ? ` at ${ticket.checkedInAt.toISOString()}` : '';
    throw new AppError(`This ticket was already checked in${when}.`, 409);
  }

  // THE double-check-in guard: atomic conditional update. Only succeeds if the
  // ticket is still 'valid' at the exact moment of the write - safe even if two
  // staff scan the same ticket at the same instant.
  const updated = await Ticket.findOneAndUpdate(
    { _id: ticketId, event: event._id, status: 'valid' },
    { $set: { status: 'used', checkedInAt: new Date(), checkedInBy: staffUserId } },
    { new: true }
  )
    .populate('user', 'name email avatar')
    .populate('ticketType', 'name');

  if (!updated) {
    throw new AppError('This ticket was just checked in by someone else.', 409);
  }

  return updated;
}

module.exports = { checkInTicket };