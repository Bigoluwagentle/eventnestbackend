const Organization = require('../models/Organization');
const OrganizationMember = require('../models/OrganizationMember');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const AppError = require('../utils/AppError');
const logger = require('../config/logger');
const { escapeRegex } = require('../utils/escapeRegex');
const { inTransaction } = require('../utils/transaction');
const { record } = require('./audit.service');
const notificationService = require('./notification.service');
const { disconnectUser } = require('../sockets');

const pagination = (total, page, limit) => ({ page, limit, total, pages: Math.ceil(total / limit) });

/**
 * Suspends or reinstates an organization. The change and its audit entry are saved in one transaction.
 * A suspended organization disappears from public pages and discovery, takes no new registrations,
 * and becomes read-only for its own members (see loadOrganization).
 */
async function setOrganizationStatus(admin, organizationId, status, reason, ip) {
  const suspending = status === 'suspended';

  const organization = await inTransaction(async (session) => {
    // one atomic, conditional update: only an organization NOT already in this status is changed
    const updated = await Organization.findOneAndUpdate(
      { _id: organizationId, status: { $ne: status } },
      { $set: { status } },
      { new: true, session }
    );
    if (!updated) {
      const exists = await Organization.exists({ _id: organizationId });
      throw exists
        ? new AppError(`This organization is already ${suspending ? 'suspended' : 'active'}`, 409)
        : new AppError('Organization not found', 404);
    }

    await record({
      admin,
      action: suspending ? 'organization.suspend' : 'organization.unsuspend',
      target: { type: 'organization', id: updated._id, label: updated.name },
      reason,
      ip,
      session,
    });
    return updated;
  });

  // Members are told afterwards: a failed notification must never undo the decision.
  try {
    const memberIds = await OrganizationMember.distinct('user', { organization: organization._id });
    if (memberIds.length) {
      await notificationService.createNotificationsForUsers(memberIds, {
        type: 'general',
        title: suspending ? 'Organization suspended' : 'Organization reinstated',
        message: suspending
          ? `${organization.name} has been suspended by the platform. Reason: ${reason}`
          : `${organization.name} is active again.`,
        data: {
          organizationId: String(organization._id),
          kind: suspending ? 'organization_suspended' : 'organization_reinstated',
        },
      });
    }
  } catch (err) {
    logger.warn(`Could not notify organization members: ${err.message}`);
  }

  return { _id: organization._id, name: organization.name, slug: organization.slug, status: organization.status };
}

/**
 * Deactivates or reactivates an account. Deactivating also signs the person out everywhere: refresh tokens
 * are revoked in the same transaction, and live sockets are closed right after it commits.
 */
async function setUserActive(admin, userId, isActive, reason, ip) {
  const target = await User.findById(userId).select('name email role isActive');
  if (!target) throw new AppError('User not found', 404);

  if (String(target._id) === String(admin._id)) {
    throw new AppError('You cannot change the status of your own account', 400);
  }
  // admins cannot lock each other out: demote first (scripts/make-super-admin.js manages the role)
  if (!isActive && target.role === 'super_admin') {
    throw new AppError('Platform admins cannot be deactivated. Remove the admin role first.', 403);
  }

  const user = await inTransaction(async (session) => {
    const updated = await User.findOneAndUpdate(
      { _id: userId, isActive: { $ne: isActive } },
      { $set: { isActive } },
      { new: true, session }
    ).select('name email');
    if (!updated) {
      throw new AppError(`This account is already ${isActive ? 'active' : 'deactivated'}`, 409);
    }

    if (!isActive) {
      await RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } }, { session });
    }

    await record({
      admin,
      action: isActive ? 'user.reactivate' : 'user.deactivate',
      target: { type: 'user', id: updated._id, label: updated.email },
      reason,
      ip,
      session,
    });
    return updated;
  });

  if (!isActive) disconnectUser(userId);

  return { _id: user._id, name: user.name, email: user.email, isActive };
}

async function listOrganizations({ search, status, page, limit }) {
  const filter = {};
  if (status) filter.status = status;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { slug: pattern }];
  }

  const [organizations, total] = await Promise.all([
    Organization.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('owner', 'name email')
      .lean(),
    Organization.countDocuments(filter),
  ]);

  return {
    organizations: organizations.map((o) => ({
      _id: o._id,
      name: o.name,
      slug: o.slug,
      status: o.status,
      isPublic: !(o.settings && o.settings.isPublic === false),
      owner: o.owner ? { _id: o.owner._id, name: o.owner.name, email: o.owner.email } : null,
      createdAt: o.createdAt,
    })),
    pagination: pagination(total, page, limit),
  };
}

async function listUsers({ search, role, active, page, limit }) {
  const filter = {};
  if (role) filter.role = role;
  if (active !== undefined) filter.isActive = active;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return {
    users: users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      isEmailVerified: u.isEmailVerified,
      createdAt: u.createdAt,
    })),
    pagination: pagination(total, page, limit),
  };
}

module.exports = { setOrganizationStatus, setUserActive, listOrganizations, listUsers };