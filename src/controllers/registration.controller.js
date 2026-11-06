const QRCode = require('qrcode');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const Event = require('../models/Event');
const TicketType = require('../models/TicketType');
const Registration = require('../models/Registration');
const Ticket = require('../models/Ticket');
const registrationService = require('../services/registration.service');
const waitlistService = require('../services/waitlist.service');
const { generateTicketToken } = require('../utils/ticketToken');

async function buildTicketPayload(ticket) {
  const token = generateTicketToken(ticket._id);
  const payload = JSON.stringify({ ticketId: ticket._id.toString(), token });
  const qrCode = await QRCode.toDataURL(payload);
  return { qrCode, token }; // token returned directly too, for easy manual testing
}

const register = asyncHandler(async (req, res) => {
  const { eventId, ticketTypeId, joinWaitlist } = req.body;

  const event = await Event.findById(eventId);
  if (!event) throw new AppError('Event not found', 404);

  const ticketType = await TicketType.findOne({ _id: ticketTypeId, event: event._id });
  if (!ticketType) throw new AppError('Ticket type not found for this event', 404);

  const { registration, ticket, waitlistPosition } = await registrationService.registerForEvent(event, ticketType, req.user, { joinWaitlist });

  // sold out, and the person asked to wait: no ticket yet, just a place in line
  if (registration.status === 'waitlisted') {
    return res.status(201).json({
      success: true,
      message: `You are on the waiting list (position ${waitlistPosition}). You will be registered automatically if a place opens up.`,
      data: { registration, waitlistPosition },
    });
  }

  let qrCode = null;
  let token = null;
  if (ticket) {
    ({ qrCode, token } = await buildTicketPayload(ticket));
  }

  return res.status(201).json({
    success: true,
    message: ticket ? 'Registration confirmed and ticket issued' : 'Registration created, payment required',
    data: { registration, ticket, qrCode, token },
  });
});

const listMyRegistrations = asyncHandler(async (req, res) => {
  const registrations = await waitlistService.listMyRegistrations(req.user._id);

  res.status(200).json({ success: true, data: { registrations } });
});

const getMyTicket = asyncHandler(async (req, res) => {
  const registration = await Registration.findOne({ _id: req.params.registrationId, user: req.user._id });
  if (!registration) throw new AppError('Registration not found', 404);

  const ticket = await Ticket.findOne({ registration: registration._id });
  if (!ticket) {
    throw new AppError(
      registration.status === 'waitlisted'
        ? 'You are on the waiting list. A ticket is issued automatically if a place opens up.'
        : 'No ticket has been issued for this registration yet',
      404
    );
  }

  const { qrCode, token } = await buildTicketPayload(ticket);

  res.status(200).json({ success: true, data: { ticket, qrCode, token } });
});

const cancelMyRegistration = asyncHandler(async (req, res) => {
  const registration = await Registration.findOne({ _id: req.params.registrationId, user: req.user._id });
  if (!registration) throw new AppError('Registration not found', 404);

  const ticket = await Ticket.findOne({ registration: registration._id });

  await registrationService.cancelRegistration(registration, ticket);

  res.status(200).json({ success: true, message: 'Registration cancelled' });
});

module.exports = { register, listMyRegistrations, getMyTicket, cancelMyRegistration };