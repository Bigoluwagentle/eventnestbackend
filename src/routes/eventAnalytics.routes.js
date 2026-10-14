const express = require('express');
const { requireEventAccess } = require('../middlewares/eventAccess');
const controller = require('../controllers/analytics.controller');

// mounted under /organizations/:orgId/events/:eventId/analytics
const router = express.Router({ mergeParams: true });

// org owner/admin/manager, or event staff who were given the view_analytics permission
router.get('/', requireEventAccess('view_analytics'), controller.getEventAnalytics);

module.exports = router;