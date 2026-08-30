const QRCode = require('qrcode');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const Event = require('../models/Event');
const TicketType = require('../models/TicketType');
const Registration = require('../models/Registration');
const Ticket = require('../models/Ticket');
const registrationService = require('../services/registration.service');
const { generateTicketToken } = require('../utils/ticketToken');

async function buildQrDataUrl(ticket) {
  const token = generateTicketToken(ticket._id);
  const payload = JSON.stringify({ ticketId: ticket._id.toString(), token });
  return QRCode.toDataURL(payload);
}

const register = asyncHandler(async (req, res) => {
  const { eventId, ticketTypeId } = req.body;

  const event = await Event.findById(eventId);
  if (!event) throw new AppError('Event not found', 404);

  const ticketType = await TicketType.findOne({ _id: ticketTypeId, event: event._id });
  if (!ticketType) throw new AppError('Ticket type not found for this event', 404);

  const { registration, ticket } = await registrationService.registerForEvent(event, ticketType, req.user);

  let qrCode = null;
  if (ticket) {
    qrCode = await buildQrDataUrl(ticket);
  }

  res.status(201).json({
    success: true,
    message: ticket ? 'Registration confirmed and ticket issued' : 'Registration created, payment required',
    data: { registration, ticket, qrCode },
  });
});

const listMyRegistrations = asyncHandler(async (req, res) => {
  const registrations = await Registration.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .populate('event', 'name slug startDate banner status')
    .populate('ticketType', 'name price currency');

  res.status(200).json({ success: true, data: { registrations } });
});

const getMyTicket = asyncHandler(async (req, res) => {
  const registration = await Registration.findOne({ _id: req.params.registrationId, user: req.user._id });
  if (!registration) throw new AppError('Registration not found', 404);

  const ticket = await Ticket.findOne({ registration: registration._id });
  if (!ticket) throw new AppError('No ticket has been issued for this registration yet', 404);

  const qrCode = await buildQrDataUrl(ticket);

  res.status(200).json({ success: true, data: { ticket, qrCode } });
});

const cancelMyRegistration = asyncHandler(async (req, res) => {
  const registration = await Registration.findOne({ _id: req.params.registrationId, user: req.user._id });
  if (!registration) throw new AppError('Registration not found', 404);

  const ticket = await Ticket.findOne({ registration: registration._id });

  await registrationService.cancelRegistration(registration, ticket);

  res.status(200).json({ success: true, message: 'Registration cancelled' });
});

module.exports = { register, listMyRegistrations, getMyTicket, cancelMyRegistration };