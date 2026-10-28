const asyncHandler = require('../utils/asyncHandler');
const moderation = require('../services/adminModeration.service');
const auditService = require('../services/audit.service');
const reportService = require('../services/report.service');

const listOrganizations = asyncHandler(async (req, res) => {
  const data = await moderation.listOrganizations(req.query);
  res.status(200).json({ success: true, data });
});

const suspendOrganization = asyncHandler(async (req, res) => {
  const organization = await moderation.setOrganizationStatus(req.user, req.params.organizationId, 'suspended', req.body.reason, req.ip);
  res.status(200).json({ success: true, message: 'Organization suspended', data: { organization } });
});

const unsuspendOrganization = asyncHandler(async (req, res) => {
  const organization = await moderation.setOrganizationStatus(req.user, req.params.organizationId, 'active', req.body.reason, req.ip);
  res.status(200).json({ success: true, message: 'Organization reinstated', data: { organization } });
});

const listUsers = asyncHandler(async (req, res) => {
  const data = await moderation.listUsers(req.query);
  res.status(200).json({ success: true, data });
});

const deactivateUser = asyncHandler(async (req, res) => {
  const user = await moderation.setUserActive(req.user, req.params.userId, false, req.body.reason, req.ip);
  res.status(200).json({ success: true, message: 'Account deactivated and signed out everywhere', data: { user } });
});

const reactivateUser = asyncHandler(async (req, res) => {
  const user = await moderation.setUserActive(req.user, req.params.userId, true, req.body.reason, req.ip);
  res.status(200).json({ success: true, message: 'Account reactivated', data: { user } });
});

const listAuditLogs = asyncHandler(async (req, res) => {
  const data = await auditService.list(req.query);
  res.status(200).json({ success: true, data });
});

const listReports = asyncHandler(async (req, res) => {
  const data = await reportService.listReports(req.query);
  res.status(200).json({ success: true, data });
});

const getReport = asyncHandler(async (req, res) => {
  const data = await reportService.getReport(req.params.reportId);
  res.status(200).json({ success: true, data });
});

const updateReport = asyncHandler(async (req, res) => {
  const report = await reportService.updateReport(req.user, req.params.reportId, req.body, req.ip);
  res.status(200).json({ success: true, message: 'Report updated', data: { report } });
});

module.exports = {
  listOrganizations, suspendOrganization, unsuspendOrganization,
  listUsers, deactivateUser, reactivateUser,
  listAuditLogs, listReports, getReport, updateReport,
};