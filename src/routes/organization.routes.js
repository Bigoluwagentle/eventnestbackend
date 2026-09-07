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

router.use(protect);

router.post('/', validate(createOrganizationSchema), controller.createOrganization);
router.get('/me', controller.listMyOrganizations);
router.get('/slug/:slug', controller.getOrganizationBySlug);
router.post('/accept-invite', validate(acceptInvitationSchema), controller.acceptInvitation);

router.use('/:orgId', loadOrganization);

// org-management actions genuinely require membership
router.patch('/:orgId', requireMembership, requireOrgRole('owner', 'admin'), validate(updateOrganizationSchema), controller.updateOrganization);
router.get('/:orgId/members', requireMembership, controller.listMembers);
router.post('/:orgId/invite', requireMembership, requireOrgRole('owner', 'admin'), validate(inviteMemberSchema), controller.inviteMember);
router.delete('/:orgId/members/:memberId', requireMembership, requireOrgRole('owner', 'admin'), controller.removeMember);
router.post('/:orgId/leave', requireMembership, controller.leaveOrganization);
router.post(
  '/:orgId/transfer-ownership',
  requireMembership,
  requireOrgRole('owner'),
  validate(transferOwnershipSchema),
  controller.transferOwnership
);

// event routes handle their own membership logic per-route (some need it, check-in doesn't)
router.use('/:orgId/events', require('./event.routes'));

module.exports = router;