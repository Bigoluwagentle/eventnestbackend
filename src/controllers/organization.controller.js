const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const organizationService = require('../services/organization.service');
const OrganizationMember = require('../models/OrganizationMember');

const createOrganization = asyncHandler(async (req, res) => {
  const organization = await organizationService.createOrganization(req.user._id, req.body);
  res.status(201).json({ success: true, message: 'Organization created', data: { organization } });
});

const listMyOrganizations = asyncHandler(async (req, res) => {
  const organizations = await organizationService.listUserOrganizations(req.user._id);
  res.status(200).json({ success: true, data: { organizations } });
});

const getOrganizationBySlug = asyncHandler(async (req, res) => {
  const organization = await organizationService.getOrganizationBySlug(req.params.slug);
  res.status(200).json({ success: true, data: { organization } });
});

const updateOrganization = asyncHandler(async (req, res) => {
  const organization = await organizationService.updateOrganization(req.organization, req.body);
  res.status(200).json({ success: true, message: 'Organization updated', data: { organization } });
});

const listMembers = asyncHandler(async (req, res) => {
  const members = await OrganizationMember.find({ organization: req.organization._id }).populate(
    'user',
    'name email avatar'
  );
  res.status(200).json({ success: true, data: { members } });
});

const inviteMember = asyncHandler(async (req, res) => {
  const invitation = await organizationService.inviteMember(
    req.organization,
    req.user._id,
    req.body.email,
    req.body.role
  );
  res.status(201).json({
    success: true,
    message: 'Invitation sent',
    data: { invitation: { id: invitation._id, email: invitation.email, role: invitation.role, status: invitation.status } },
  });
});

const acceptInvitation = asyncHandler(async (req, res) => {
  const membership = await organizationService.acceptInvitation(req.body.token, req.user);
  res.status(200).json({ success: true, message: 'Invitation accepted', data: { membership } });
});

const removeMember = asyncHandler(async (req, res) => {
  const targetMembership = await OrganizationMember.findOne({
    _id: req.params.memberId,
    organization: req.organization._id,
  });
  if (!targetMembership) throw new AppError('Member not found', 404);

  await organizationService.removeMember(req.organization, targetMembership);
  res.status(200).json({ success: true, message: 'Member removed' });
});

const leaveOrganization = asyncHandler(async (req, res) => {
  await organizationService.leaveOrganization(req.organization, req.membership);
  res.status(200).json({ success: true, message: 'You have left the organization' });
});

const transferOwnership = asyncHandler(async (req, res) => {
  const organization = await organizationService.transferOwnership(
    req.organization,
    req.membership,
    req.body.newOwnerUserId
  );
  res.status(200).json({ success: true, message: 'Ownership transferred', data: { organization } });
});

module.exports = {
  createOrganization,
  listMyOrganizations,
  getOrganizationBySlug,
  updateOrganization,
  listMembers,
  inviteMember,
  acceptInvitation,
  removeMember,
  leaveOrganization,
  transferOwnership,
};