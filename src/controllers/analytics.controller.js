const asyncHandler = require('../utils/asyncHandler');
const analyticsService = require('../services/analytics.service');

const getEventAnalytics = asyncHandler(async (req, res) => {
  const analytics = await analyticsService.getEventAnalytics(req.event);
  res.status(200).json({ success: true, data: { analytics } });
});

const getOrganizationAnalytics = asyncHandler(async (req, res) => {
  const analytics = await analyticsService.getOrganizationAnalytics(req.organization);
  res.status(200).json({ success: true, data: { analytics } });
});

const getPlatformAnalytics = asyncHandler(async (req, res) => {
  const analytics = await analyticsService.getPlatformAnalytics();
  res.status(200).json({ success: true, data: { analytics } });
});

module.exports = { getEventAnalytics, getOrganizationAnalytics, getPlatformAnalytics };