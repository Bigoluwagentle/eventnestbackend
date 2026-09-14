const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const EventStaff = require('../models/EventStaff');

const ORG_ROLES_WITH_FULL_EVENT_ACCESS = ['owner', 'admin', 'manager'];

function requireEventAccess(requiredPermission) {
  return asyncHandler(async (req, res, next) => {
    if (req.membership && ORG_ROLES_WITH_FULL_EVENT_ACCESS.includes(req.membership.role)) {
      return next();
    }

    const staffRecord = await EventStaff.findOne({ event: req.event._id, user: req.user._id });

    if (!staffRecord || !staffRecord.permissions.includes(requiredPermission)) {
      return next(new AppError(`You do not have "${requiredPermission}" permission for this event`, 403));
    }

    req.staffPermissions = staffRecord.permissions;
    next();
  });
}

/**
 * Looser check: any org member (owner/admin/manager) OR any EventStaff record
 * at all, regardless of specific permission. Use for read-only views (like
 * viewing the schedule) where every staff role should reasonably be able to see it.
 */
const requireAnyEventAccess = asyncHandler(async (req, res, next) => {
  if (req.membership) {
    return next();
  }
  const staffRecord = await EventStaff.findOne({ event: req.event._id, user: req.user._id });
  if (!staffRecord) {
    return next(new AppError('You do not have access to this event', 403));
  }
  req.staffPermissions = staffRecord.permissions;
  next();
});

module.exports = { requireEventAccess, requireAnyEventAccess };