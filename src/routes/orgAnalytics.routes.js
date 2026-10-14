const express = require('express');
const { requireMembership, requireOrgRole } = require('../middlewares/tenant');
const controller = require('../controllers/analytics.controller');

// mounted under /organizations/:orgId/analytics
const router = express.Router({ mergeParams: true });

router.get('/', requireMembership, requireOrgRole('owner', 'admin', 'manager'), controller.getOrganizationAnalytics);

module.exports = router;