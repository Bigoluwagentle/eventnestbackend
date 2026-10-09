const Announcement = require('../models/Announcement');
const Registration = require('../models/Registration');
const notificationService = require('./notification.service');
const { getIO } = require('../sockets');
const logger = require('../config/logger');

async function createAnnouncement(event, organizationId, userId, { title, message }) {
  const announcement = await Announcement.create({
    event: event._id,
    organization: organizationId,
    title,
    message,
    createdBy: userId,
  });

  // fan out a persisted notification to every confirmed attendee
  const registrations = await Registration.find({ event: event._id, status: 'confirmed' }).select('user');
  const userIds = registrations.map((r) => r.user);

  await notificationService.createNotificationsForUsers(userIds, {
    type: 'announcement',
    title,
    message,
    data: { eventId: event._id.toString(), announcementId: announcement._id.toString() },
  });

  // live push to anyone currently connected and in this event's room
  try {
    getIO()
      .to(`event:${event._id}`)
      .emit('announcement:new', {
        _id: announcement._id,
        eventId: event._id,
        title,
        message,
        createdAt: announcement.createdAt,
      });
  } catch (err) {
    logger.warn(`Could not emit live announcement: ${err.message}`);
  }

  return announcement;
}

async function listAnnouncements(eventId) {
  return Announcement.find({ event: eventId }).sort({ createdAt: -1 });
}

module.exports = { createAnnouncement, listAnnouncements };