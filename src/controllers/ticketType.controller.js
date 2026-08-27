const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const TicketType = require('../models/TicketType');
const ticketTypeService = require('../services/ticketType.service');

const createTicketType = asyncHandler(async (req, res) => {
  const ticketType = await ticketTypeService.createTicketType(req.event, req.organization._id, req.body);
  res.status(201).json({ success: true, message: 'Ticket type created', data: { ticketType } });
});

const listTicketTypes = asyncHandler(async (req, res) => {
  const includeInactive = ['owner', 'admin', 'manager'].includes(req.membership?.role);
  const ticketTypes = await ticketTypeService.listTicketTypes(req.event._id, { includeInactive });
  res.status(200).json({ success: true, data: { ticketTypes } });
});

const loadTicketType = asyncHandler(async (req, res, next) => {
  const ticketType = await TicketType.findOne({ _id: req.params.ticketTypeId, event: req.event._id });
  if (!ticketType) return next(new AppError('Ticket type not found', 404));
  req.ticketType = ticketType;
  next();
});

const updateTicketType = asyncHandler(async (req, res) => {
  const ticketType = await ticketTypeService.updateTicketType(req.ticketType, req.body);
  res.status(200).json({ success: true, message: 'Ticket type updated', data: { ticketType } });
});

const deleteTicketType = asyncHandler(async (req, res) => {
  await ticketTypeService.deleteTicketType(req.ticketType);
  res.status(200).json({ success: true, message: 'Ticket type deleted' });
});

module.exports = { createTicketType, listTicketTypes, loadTicketType, updateTicketType, deleteTicketType };