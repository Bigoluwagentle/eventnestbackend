const TicketType = require('../models/TicketType');
const AppError = require('../utils/AppError');

async function createTicketType(event, organizationId, data) {
  const ticketType = await TicketType.create({
    ...data,
    event: event._id,
    organization: organizationId,
  });
  return ticketType;
}

async function listTicketTypes(eventId, { includeInactive = false } = {}) {
  const filter = { event: eventId };
  if (!includeInactive) filter.isActive = true;
  return TicketType.find(filter).sort({ price: 1 });
}

async function updateTicketType(ticketType, updates) {
  if (updates.quantity !== undefined && updates.quantity < ticketType.quantitySold) {
    throw new AppError(
      `Cannot set quantity below ${ticketType.quantitySold} tickets already sold`,
      400
    );
  }
  Object.assign(ticketType, updates);
  await ticketType.save();
  return ticketType;
}

async function deleteTicketType(ticketType) {
  if (ticketType.quantitySold > 0) {
    throw new AppError('Cannot delete a ticket type with existing sales. Deactivate it instead.', 400);
  }
  await ticketType.deleteOne();
}

module.exports = { createTicketType, listTicketTypes, updateTicketType, deleteTicketType };