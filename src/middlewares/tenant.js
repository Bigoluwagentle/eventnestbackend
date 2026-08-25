const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const Organization = require('../models/Organization');
const OrganizationMember = require('../models/OrganizationMember');

/**
 * Loads the organization from :orgId in the URL and attaches it to req.organization.
 * Must run before requireMembership.
 */
const loadOrganization = asyncHandler(async (req, res, next) => {
  const { orgId } = req.params;
  const organization = await Organization.findById(orgId);

  if (!organization) {
    return next(new AppError('Organization not found', 404));
  }

  req.organization = organization;
  next();
});

/**
 * Verifies the authenticated user is a member of req.organization.
 * This is the core tenant-isolation check - every org-scoped route needs it.
 * Attaches the membership (with role) to req.membership.
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
  next();
});

/**
 * Restricts to specific org-level roles (owner/admin/manager).
 * Must run after requireMembership.
 */
function requireOrgRole(...roles) {
  return (req, res, next) => {
    if (!req.membership || !roles.includes(req.membership.role)) {
      return next(new AppError('You do not have permission to perform this action in this organization', 403));
    }
    next();
  };
}

module.exports = { loadOrganization, requireMembership, requireOrgRole };