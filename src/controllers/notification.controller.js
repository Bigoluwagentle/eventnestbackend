const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const notificationService = require('../services/notification.service');

const listMyNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.listMyNotifications(req.user._id, req.query);
  res.status(200).json({ success: true, data: result });
});

const markAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markAsRead(req.user._id, req.params.notificationId);
  // someone else's notification looks exactly like a missing one
  if (!notification) throw new AppError('Notification not found', 404);
  res.status(200).json({ success: true, data: { notification } });
});

const markAllAsRead = asyncHandler(async (req, res) => {
  await notificationService.markAllAsRead(req.user._id);
  res.status(200).json({ success: true, message: 'All notifications marked as read' });
});

module.exports = { listMyNotifications, markAsRead, markAllAsRead };