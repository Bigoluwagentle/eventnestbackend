const TicketType = require('../models/TicketType');
const AppError = require('../utils/AppError');

// event.capacity caps the TOTAL tickets offered across all ticket types. Ticket inventory stays the
// single source of truth (no second counter that could drift): the cap is checked when tickets are
// configured, not at registration time.
async function totalInventory(eventId, excludeTicketTypeId) {
  const match = { event: eventId };
  if (excludeTicketTypeId) match._id = { $ne: excludeTicketTypeId };
  const rows = await TicketType.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$quantity' } } }]);
  return rows.length ? rows[0].total : 0;
}

async function assertWithinCapacity(event, quantity, excludeTicketTypeId) {
  if (!event.capacity) return; // no capacity set: unlimited
  const total = (await totalInventory(event._id, excludeTicketTypeId)) + quantity;
  if (total > event.capacity) {
    throw new AppError(`That would offer ${total} tickets in total, but the event capacity is ${event.capacity}`, 400);
  }
}

// used when an event's capacity is lowered
async function assertInventoryFitsCapacity(eventId, capacity) {
  const total = await totalInventory(eventId);
  if (total > capacity) {
    throw new AppError(
      `Tickets already offered total ${total}, which is more than the new capacity of ${capacity}. Reduce the ticket quantities first.`,
      400
    );
  }
}

async function createTicketType(event, organizationId, data) {
  await assertWithinCapacity(event, data.quantity);
  return TicketType.create({ ...data, event: event._id, organization: organizationId });
}

async function listTicketTypes(eventId, { includeInactive = false } = {}) {
  const filter = { event: eventId };
  if (!includeInactive) filter.isActive = true;
  return TicketType.find(filter).sort({ price: 1 });
}

async function updateTicketType(event, ticketType, updates) {
  if (updates.quantity !== undefined) {
    if (updates.quantity < ticketType.quantitySold) {
      throw new AppError(`Cannot set quantity below ${ticketType.quantitySold} tickets already sold`, 400);
    }
    await assertWithinCapacity(event, updates.quantity, ticketType._id);
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

module.exports = {
  createTicketType,
  listTicketTypes,
  updateTicketType,
  deleteTicketType,
  assertInventoryFitsCapacity,
};