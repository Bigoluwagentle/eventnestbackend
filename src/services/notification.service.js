const Notification = require('../models/Notification');

async function createNotification(userId, { type, title, message, data = {} }) {
  return Notification.create({ user: userId, type, title, message, data });
}

/**
 * Bulk-creates one notification per user. Used for event-wide fan-out
 * (e.g. announcements). Runs as a single insertMany for efficiency.
 *
 * NOTE: synchronous bulk insert - fine at portfolio/small-event scale.
 * For large attendee lists this is the natural place to swap in a
 * background job (BullMQ) instead of blocking the request.
 */
async function createNotificationsForUsers(userIds, { type, title, message, data = {} }) {
  if (!userIds.length) return [];
  const docs = userIds.map((userId) => ({ user: userId, type, title, message, data }));
  return Notification.insertMany(docs);
}

async function listMyNotifications(userId, { page = 1, limit = 20, unreadOnly = false }) {
  const filter = { user: userId };
  if (unreadOnly) filter.isRead = false;

  const skip = (page - 1) * limit;
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: userId, isRead: false }),
  ]);

  return { notifications, unreadCount, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function markAsRead(userId, notificationId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { $set: { isRead: true } },
    { new: true }
  );
}

async function markAllAsRead(userId) {
  await Notification.updateMany({ user: userId, isRead: false }, { $set: { isRead: true } });
}

module.exports = {
  createNotification,
  createNotificationsForUsers,
  listMyNotifications,
  markAsRead,
  markAllAsRead,
};