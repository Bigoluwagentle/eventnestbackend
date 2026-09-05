const express = require('express');
const validate = require('../middlewares/validate');
const { requireOrgRole } = require('../middlewares/tenant');
const controller = require('../controllers/eventStaff.controller');
const { addStaffSchema, updateStaffPermissionsSchema } = require('../validators/eventStaff.validator');

// mounted under /organizations/:orgId/events/:eventId/staff
const router = express.Router({ mergeParams: true });

// managing WHO is staff is an org-management action, restricted to owner/admin/manager
router.post('/', requireOrgRole('owner', 'admin', 'manager'), validate(addStaffSchema), controller.addStaff);
router.get('/', requireOrgRole('owner', 'admin', 'manager'), controller.listStaff);

router.use('/:staffId', controller.loadStaff);
router.patch(
  '/:staffId',
  requireOrgRole('owner', 'admin', 'manager'),
  validate(updateStaffPermissionsSchema),
  controller.updateStaffPermissions
);
router.delete('/:staffId', requireOrgRole('owner', 'admin', 'manager'), controller.removeStaff);

module.exports = router;