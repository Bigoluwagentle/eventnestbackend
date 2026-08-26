const express = require('express');
const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');
const { loadOrganization, requireMembership, requireOrgRole } = require('../middlewares/tenant');
const controller = require('../controllers/organization.controller');
const {
  createOrganizationSchema,
  updateOrganizationSchema,
  inviteMemberSchema,
  acceptInvitationSchema,
  transferOwnershipSchema,
} = require('../validators/organization.validator');

const router = express.Router();

// all organization routes require a logged-in user
router.use(protect);

router.post('/', validate(createOrganizationSchema), controller.createOrganization);
router.get('/me', controller.listMyOrganizations);
router.get('/slug/:slug', controller.getOrganizationBySlug);
router.post('/accept-invite', validate(acceptInvitationSchema), controller.acceptInvitation);

// org-scoped routes: load org + verify membership first
router.use('/:orgId', loadOrganization, requireMembership);
router.use('/:orgId/events', require('./event.routes'));

router.patch('/:orgId', requireOrgRole('owner', 'admin'), validate(updateOrganizationSchema), controller.updateOrganization);
router.get('/:orgId/members', controller.listMembers);
router.post('/:orgId/invite', requireOrgRole('owner', 'admin'), validate(inviteMemberSchema), controller.inviteMember);
router.delete('/:orgId/members/:memberId', requireOrgRole('owner', 'admin'), controller.removeMember);
router.post('/:orgId/leave', controller.leaveOrganization);
router.post(
  '/:orgId/transfer-ownership',
  requireOrgRole('owner'),
  validate(transferOwnershipSchema),
  controller.transferOwnership
);

module.exports = router;