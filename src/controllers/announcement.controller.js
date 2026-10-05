const asyncHandler = require('../utils/asyncHandler');
const announcementService = require('../services/announcement.service');

const createAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await announcementService.createAnnouncement(
    req.event,
    req.organization._id,
    req.user._id,
    req.body
  );
  res.status(201).json({ success: true, message: 'Announcement sent', data: { announcement } });
});

const listAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await announcementService.listAnnouncements(req.event._id);
  res.status(200).json({ success: true, data: { announcements } });
});

module.exports = { createAnnouncement, listAnnouncements };