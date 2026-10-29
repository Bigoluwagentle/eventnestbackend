const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const Organization = require('../models/Organization');
const OrganizationMember = require('../models/OrganizationMember');

const READ_ONLY_METHODS = ['GET', 'HEAD', 'OPTIONS'];

const loadOrganization = asyncHandler(async (req, res, next) => {
  const { orgId } = req.params;
  const organization = await Organization.findById(orgId);

  if (!organization) {
    return next(new AppError('Organization not found', 404));
  }

  // A suspended organization is read-only for its members: they can still look at their data,
  // but nothing can be created, changed or deleted until the platform reinstates it.
  if (organization.status === 'suspended' && !READ_ONLY_METHODS.includes(req.method)) {
    return next(new AppError('This organization has been suspended by the platform. Contact support.', 403));
  }

  req.organization = organization;
  return next();
});

/**
 * Hard requirement: blocks the request entirely if the user isn't a member.
 * Use for org-management routes (settings, invites, member removal, etc.)
 */
const requireMembership = asyncHandler(async (req, res, next) => {
  const membership = await OrganizationMember.findOne({
    organization: req.organization._id,
    user: req.user._id,
  });

  if (!membership) {
    return next(new AppError('You do not have access to this organization', 403));
  }

  req.membership = membership;
  return next();
});

/**
 * Soft check: attaches req.membership if it exists, but does NOT block the
 * request if it doesn't. Use for event-level routes where non-org-members
 * (e.g. EventStaff) should still be able to proceed to a narrower permission check.
 */
const attachMembershipIfExists = asyncHandler(async (req, res, next) => {
  const membership = await OrganizationMember.findOne({
    organization: req.organization._id,
    user: req.user._id,
  });
  req.membership = membership || null;
  next();
});

function requireOrgRole(...roles) {
  return (req, res, next) => {
    if (!req.membership || !roles.includes(req.membership.role)) {
      return next(new AppError('You do not have permission to perform this action in this organization', 403));
    }
    return next();
  };
}

module.exports = { loadOrganization, requireMembership, attachMembershipIfExists, requireOrgRole };