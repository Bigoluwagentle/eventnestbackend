const asyncHandler = require('../utils/asyncHandler');
const publicEventService = require('../services/publicEvent.service');

const getPublicTicketTypes = asyncHandler(async (req, res) => {
  const ticketTypes = await publicEventService.getPublicTicketTypes(req.params.orgSlug, req.params.eventSlug);
  res.status(200).json({ success: true, data: { ticketTypes } });
});

const getJoinInfo = asyncHandler(async (req, res) => {
  const info = await publicEventService.getJoinInfo(req.params.orgSlug, req.params.eventSlug, req.user._id);
  res.status(200).json({ success: true, data: info });
});

module.exports = { getPublicTicketTypes, getJoinInfo };