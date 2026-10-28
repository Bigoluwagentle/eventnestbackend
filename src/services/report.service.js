const Report = require('../models/Report');
const Event = require('../models/Event');
const Organization = require('../models/Organization');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { canAccessEvent } = require('../utils/eventParticipation');
const { inTransaction } = require('../utils/transaction');
const { record } = require('./audit.service');

// You can only report what you can see; anything else looks exactly like something that doesn't exist.
async function assertReportable(reporter, targetType, targetId) {
  if (targetType === 'event') {
    const event = await Event.findById(targetId).select('status visibility');
    const publiclyVisible = event && ['public', 'unlisted'].includes(event.visibility) && !['draft', 'cancelled'].includes(event.status);
    if (!event || !(publiclyVisible || (await canAccessEvent(reporter._id, event._id)))) {
      throw new AppError('Event not found', 404);
    }
  } else if (targetType === 'organization') {
    if (!(await Organization.exists({ _id: targetId, status: 'active' }))) throw new AppError('Organization not found', 404);
  } else {
    if (String(targetId) === String(reporter._id)) throw new AppError('You cannot report yourself', 400);
    if (!(await User.exists({ _id: targetId, isActive: true }))) throw new AppError('User not found', 404);
  }
}

async function createReport(reporter, { targetType, targetId, reason, details }) {
  await assertReportable(reporter, targetType, targetId);

  // already open or being reviewed: no second report for the same thing from the same person
  const duplicate = await Report.exists({
    reporter: reporter._id, targetType, targetId, status: { $in: ['open', 'reviewing'] },
  });
  if (duplicate) throw new AppError('You have already reported this. It is being looked at.', 409);

  try {
    const report = await Report.create({ reporter: reporter._id, targetType, targetId, reason, details: details || '' });
    return { _id: report._id, status: report.status, createdAt: report.createdAt };
  } catch (err) {
    // two identical requests at once: the unique index lets only one through
    if (err.code === 11000) throw new AppError('You have already reported this. It is being looked at.', 409);
    throw err;
  }
}

async function listReports({ status, targetType, page, limit }) {
  const filter = {};
  if (status) filter.status = status;
  if (targetType) filter.targetType = targetType;

  const [reports, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reporter', 'name')
      .lean(),
    Report.countDocuments(filter),
  ]);

  return { reports, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

// what the reported thing is, so an admin can judge the report without hunting for it
async function summarizeTarget(report) {
  const lookups = {
    event: () => Event.findById(report.targetId).select('name slug status organization').lean(),
    organization: () => Organization.findById(report.targetId).select('name slug status').lean(),
    user: () => User.findById(report.targetId).select('name email role isActive').lean(),
  };
  return (await lookups[report.targetType]()) || null; // null if it has been deleted since
}

async function getReport(reportId) {
  const report = await Report.findById(reportId).populate('reporter', 'name').lean();
  if (!report) throw new AppError('Report not found', 404);
  return { report, target: await summarizeTarget(report) };
}

// which statuses a report may move FROM, for each status it can move TO
const ALLOWED_FROM = { reviewing: ['open'], resolved: ['open', 'reviewing'], dismissed: ['open', 'reviewing'] };

async function updateReport(admin, reportId, { status, resolution }, ip) {
  return inTransaction(async (session) => {
    const closing = status !== 'reviewing';
    const update = { status, ...(closing ? { resolution: resolution || null, resolvedBy: admin._id, resolvedAt: new Date() } : {}) };

    // atomic: only a report currently in an allowed status can move (closed reports are final)
    const report = await Report.findOneAndUpdate(
      { _id: reportId, status: { $in: ALLOWED_FROM[status] } },
      { $set: update },
      { new: true, session }
    );
    if (!report) {
      const exists = await Report.exists({ _id: reportId });
      throw exists
        ? new AppError('This report is already closed or already under review', 409)
        : new AppError('Report not found', 404);
    }

    await record({
      admin,
      action: `report.${status}`,
      target: { type: 'report', id: report._id, label: `${report.targetType}: ${report.reason}` },
      reason: resolution,
      metadata: { targetType: report.targetType, targetId: String(report.targetId) },
      ip,
      session,
    });

    return { _id: report._id, status: report.status, resolution: report.resolution, resolvedAt: report.resolvedAt };
  });
}

module.exports = { createReport, listReports, getReport, updateReport };