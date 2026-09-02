const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const EventStaff = require('../models/EventStaff');

const ORG_ROLES_WITH_FULL_EVENT_ACCESS = ['owner', 'admin', 'manager'];

/**
 * Grants access if the user is an org owner/admin/manager (full access to all
 * events in the org), OR has an explicit EventStaff record with the required
 * permission for this specific event.
 *
 * Must run after loadOrganization + requireMembership + loadEvent.
 */
function requireEventAccess(requiredPermission) {
  return asyncHandler(async (req, res, next) => {
    if (ORG_ROLES_WITH_FULL_EVENT_ACCESS.includes(req.membership.role)) {
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

module.exports = { requireEventAccess };