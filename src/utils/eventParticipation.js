const Registration = require('../models/Registration');
const EventStaff = require('../models/EventStaff');
const OrganizationMember = require('../models/OrganizationMember');
const Event = require('../models/Event');

/**
 * True if the user is a confirmed attendee, event staff, or an org member
 * for the event's organization. Shared by the Socket.IO room-join check
 * and the REST requireEventParticipant middleware, so both stay in sync.
 */
async function canAccessEvent(userId, eventId) {
  const [registration, staffRecord] = await Promise.all([
    Registration.findOne({ event: eventId, user: userId, status: 'confirmed' }),
    EventStaff.findOne({ event: eventId, user: userId }),
  ]);
  if (registration || staffRecord) return true;

  const event = await Event.findById(eventId).select('organization');
  if (!event) return false;

  const membership = await OrganizationMember.findOne({ organization: event.organization, user: userId });
  return !!membership;
}

module.exports = { canAccessEvent };