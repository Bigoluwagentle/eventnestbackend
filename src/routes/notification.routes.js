const express = require('express');
const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');
const controller = require('../controllers/notification.controller');
const { listNotificationsSchema, notificationIdSchema } = require('../validators/notification.validator');

const router = express.Router();

router.use(protect);

router.get('/', validate(listNotificationsSchema), controller.listMyNotifications);
router.patch('/read-all', controller.markAllAsRead);
router.patch('/:notificationId/read', validate(notificationIdSchema), controller.markAsRead);

module.exports = router;