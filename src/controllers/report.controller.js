const asyncHandler = require('../utils/asyncHandler');
const reportService = require('../services/report.service');

const createReport = asyncHandler(async (req, res) => {
  const report = await reportService.createReport(req.user, req.body);
  res.status(201).json({ success: true, message: 'Thank you. Your report was sent to the platform team.', data: { report } });
});

module.exports = { createReport };