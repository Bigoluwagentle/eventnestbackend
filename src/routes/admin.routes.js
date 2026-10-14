const express = require('express');
const { protect, restrictTo } = require('../middlewares/auth');
const controller = require('../controllers/analytics.controller');

// mounted under /admin - platform-level, super admins only
const router = express.Router();

router.use(protect, restrictTo('super_admin'));

router.get('/analytics', controller.getPlatformAnalytics);

module.exports = router;