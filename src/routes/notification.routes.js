const express = require('express');
const { protect } = require('../middlewares/auth');
const controller = require('../controllers/notification.controller');

const router = express.Router();

router.use(protect);

router.get('/', controller.listMyNotifications);
router.patch('/:notificationId/read', controller.markAsRead);
router.patch('/read-all', controller.markAllAsRead);

module.exports = router;