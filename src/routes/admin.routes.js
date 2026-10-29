const express = require('express');
const validate = require('../middlewares/validate');
const { protect, restrictTo } = require('../middlewares/auth');
const analyticsController = require('../controllers/analytics.controller');
const controller = require('../controllers/admin.controller');
const {
  listOrganizationsSchema, listUsersSchema, suspendOrganizationSchema, unsuspendOrganizationSchema,
  deactivateUserSchema, reactivateUserSchema, listAuditLogsSchema, listReportsSchema, reportIdSchema, updateReportSchema,
} = require('../validators/admin.validator');

// mounted under /admin - platform-level, super admins only
const router = express.Router();

router.use(protect, restrictTo('super_admin'));

router.get('/analytics', analyticsController.getPlatformAnalytics);

router.get('/organizations', validate(listOrganizationsSchema), controller.listOrganizations);
router.post('/organizations/:organizationId/suspend', validate(suspendOrganizationSchema), controller.suspendOrganization);
router.post('/organizations/:organizationId/unsuspend', validate(unsuspendOrganizationSchema), controller.unsuspendOrganization);

router.get('/users', validate(listUsersSchema), controller.listUsers);
router.post('/users/:userId/deactivate', validate(deactivateUserSchema), controller.deactivateUser);
router.post('/users/:userId/reactivate', validate(reactivateUserSchema), controller.reactivateUser);

router.get('/audit-logs', validate(listAuditLogsSchema), controller.listAuditLogs);

router.get('/reports', validate(listReportsSchema), controller.listReports);
router.get('/reports/:reportId', validate(reportIdSchema), controller.getReport);
router.patch('/reports/:reportId', validate(updateReportSchema), controller.updateReport);

module.exports = router;