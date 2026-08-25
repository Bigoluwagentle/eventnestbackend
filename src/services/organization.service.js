const crypto = require('crypto');
const Organization = require('../models/Organization');
const OrganizationMember = require('../models/OrganizationMember');
const Invitation = require('../models/Invitation');
const AppError = require('../utils/AppError');
const logger = require('../config/logger');
const { generateUniqueSlug } = require('../utils/slugify');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createOrganization(userId, { name, description, website }) {
  const slug = await generateUniqueSlug(name, async (candidate) => {
    const existing = await Organization.findOne({ slug: candidate });
    return !!existing;
  });

  const organization = await Organization.create({
    name,
    slug,
    description,
    website,
    owner: userId,
  });

  await OrganizationMember.create({
    organization: organization._id,
    user: userId,
    role: 'owner',
  });

  return organization;
}

async function listUserOrganizations(userId) {
  const memberships = await OrganizationMember.find({ user: userId }).populate('organization');
  return memberships
    .filter((m) => m.organization)
    .map((m) => ({ organization: m.organization, role: m.role, joinedAt: m.joinedAt }));
}

async function getOrganizationBySlug(slug) {
  const organization = await Organization.findOne({ slug, status: 'active' });
  if (!organization) throw new AppError('Organization not found', 404);
  return organization;
}

async function updateOrganization(organization, updates) {
  Object.assign(organization, updates);
  await organization.save();
  return organization;
}

async function inviteMember(organization, invitedByUserId, email, role) {
  const existingMember = await OrganizationMember.findOne({ organization: organization._id }).populate({
    path: 'user',
    match: { email },
  });
  if (existingMember?.user) {
    throw new AppError('This user is already a member of the organization', 409);
  }

  const rawToken = crypto.randomBytes(32).toString('hex');

  const invitation = await Invitation.findOneAndUpdate(
    { organization: organization._id, email, status: 'pending' },
    {
      organization: organization._id,
      email,
      role,
      invitedBy: invitedByUserId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'pending',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // TODO: replace with real email once email provider is wired up
  logger.info(`[DEV] Invitation token for ${email} to join "${organization.name}": ${rawToken}`);

  return invitation;
}

async function acceptInvitation(rawToken, user) {
  const tokenHash = hashToken(rawToken);

  const invitation = await Invitation.findOne({
    tokenHash,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).select('+tokenHash');

  if (!invitation) {
    throw new AppError('Invitation is invalid or has expired', 400);
  }

  if (invitation.email !== user.email) {
    throw new AppError('This invitation was sent to a different email address', 403);
  }

  const alreadyMember = await OrganizationMember.findOne({
    organization: invitation.organization,
    user: user._id,
  });
  if (alreadyMember) {
    invitation.status = 'accepted';
    await invitation.save();
    throw new AppError('You are already a member of this organization', 409);
  }

  const membership = await OrganizationMember.create({
    organization: invitation.organization,
    user: user._id,
    role: invitation.role,
    invitedBy: invitation.invitedBy,
  });

  invitation.status = 'accepted';
  await invitation.save();

  return membership;
}

async function removeMember(organization, targetMembership) {
  if (targetMembership.role === 'owner') {
    throw new AppError('Cannot remove the organization owner. Transfer ownership first.', 400);
  }
  await targetMembership.deleteOne();
}

async function leaveOrganization(organization, membership) {
  if (membership.role === 'owner') {
    throw new AppError('Owner cannot leave the organization. Transfer ownership first.', 400);
  }
  await membership.deleteOne();
}

async function transferOwnership(organization, currentOwnerMembership, newOwnerUserId) {
  const newOwnerMembership = await OrganizationMember.findOne({
    organization: organization._id,
    user: newOwnerUserId,
  });

  if (!newOwnerMembership) {
    throw new AppError('Target user must already be a member of the organization', 400);
  }

  newOwnerMembership.role = 'owner';
  currentOwnerMembership.role = 'admin';
  organization.owner = newOwnerUserId;

  await Promise.all([newOwnerMembership.save(), currentOwnerMembership.save(), organization.save()]);

  return organization;
}

module.exports = {
  createOrganization,
  listUserOrganizations,
  getOrganizationBySlug,
  updateOrganization,
  inviteMember,
  acceptInvitation,
  removeMember,
  leaveOrganization,
  transferOwnership,
};