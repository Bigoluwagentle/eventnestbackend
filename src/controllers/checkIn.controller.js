const asyncHandler = require('../utils/asyncHandler');
const Ticket = require('../models/Ticket');
const checkInService = require('../services/checkIn.service');

const checkIn = asyncHandler(async (req, res) => {
  const ticket = await checkInService.checkInTicket(req.event, req.body.ticketId, req.body.token, req.user._id);
  res.status(200).json({ success: true, message: 'Checked in successfully', data: { ticket } });
});

const listAttendees = asyncHandler(async (req, res) => {
  const tickets = await Ticket.find({ event: req.event._id })
    .populate('user', 'name email avatar')
    .populate('ticketType', 'name')
    .sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: { attendees: tickets } });
});

module.exports = { checkIn, listAttendees };