const asyncHandler = require('../utils/asyncHandler');
const waitlistView = require('../services/waitlistView.service');

const listWaitlist = asyncHandler(async (req, res) => {
  const data = await waitlistView.listWaitlist(req.ticketType, req.query);
  res.status(200).json({ success: true, data });
});

module.exports = { listWaitlist };