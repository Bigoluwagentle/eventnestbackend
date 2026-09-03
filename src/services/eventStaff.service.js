const User = require('../models/User');
const EventStaff = require('../models/EventStaff');
const AppError = require('../utils/AppError');
const logger = require('../config/logger');

async function addStaff(event, organizationId, invitedByUserId, email, permissions) {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('No EventNest account found with this email. Ask them to sign up first.', 404);
  }

  const existing = await EventStaff.findOne({ event: event._id, user: user._id });
  if (existing) {
    throw new AppError('This user is already staff for this event', 409);
  }

  const staff = await EventStaff.create({
    event: event._id,
    organization: organizationId,
    user: user._id,
    permissions,
    addedBy: invitedByUserId,
  });

  logger.info(`[DEV] ${email} added as staff for "${event.name}" with permissions: ${permissions.join(', ')}`);

  return staff;
}

async function listStaff(eventId) {
  return EventStaff.find({ event: eventId }).populate('user', 'name email avatar');
}

async function updateStaffPermissions(staffRecord, permissions) {
  staffRecord.permissions = permissions;
  await staffRecord.save();
  return staffRecord;
}

async function removeStaff(staffRecord) {
  await staffRecord.deleteOne();
}

module.exports = { addStaff, listStaff, updateStaffPermissions, removeStaff };