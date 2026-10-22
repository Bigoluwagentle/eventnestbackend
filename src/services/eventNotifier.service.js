const Registration = require('../models/Registration');
const SessionBookmark = require('../models/SessionBookmark');
const notificationService = require('./notification.service');
const logger = require('../config/logger');
const { emitToEvent } = require('../utils/realtime');

// Telling people about a change must never undo or fail the change itself, so NOTHING in here throws:
// problems are logged and the caller carries on.
async function safely(label, work) {
  try {
    await work();
  } catch (err) {
    logger.warn(`${label} failed: ${err.message}`);
  }
}

async function notifyUsers(userIds, payload) {
  if (!userIds.length) return;
  await notificationService.createNotificationsForUsers(userIds, payload);
}

// People with a confirmed registration (the same group announcements go to).
const confirmedAttendees = (eventId) => Registration.distinct('user', { event: eventId, status: 'confirmed' });

/** The organizer cancelled the event. */
async function notifyEventCancelled(event) {
  await safely('Cancellation notification', async () => {
    await notifyUsers(await confirmedAttendees(event._id), {
      type: 'general',
      title: 'Event cancelled',
      message: `${event.name} has been cancelled by the organizer.`,
      data: { eventId: String(event._id), kind: 'event_cancelled' },
    });
  });
  emitToEvent(event._id, 'event:cancelled', { eventId: event._id });
}

/** Date, place, format or online link changed. `changes` is a list of human-readable labels. */
async function notifyEventChanged(event, changes) {
  await safely('Event change notification', async () => {
    await notifyUsers(await confirmedAttendees(event._id), {
      type: 'schedule_changed',
      title: 'Event details changed',
      message: `Details of ${event.name} have changed: ${changes.join(', ')}. Please check the event page.`,
      data: { eventId: String(event._id), kind: 'event_updated', changes },
    });
  });
  emitToEvent(event._id, 'event:updated', { eventId: event._id, changes });
}

/** A session's time or place changed, or it was removed. Only people who bookmarked it are told. */
async function notifyScheduleChange(session, { timeChanged = false, placeChanged = false, removed = false }) {
  const parts = [timeChanged && 'time', placeChanged && 'location'].filter(Boolean);

  await safely('Schedule change notification', async () => {
    const bookmarkers = await SessionBookmark.distinct('user', { session: session._id });
    await notifyUsers(bookmarkers, {
      type: 'schedule_changed',
      title: removed ? 'Session removed' : 'Schedule change',
      message: removed
        ? `"${session.title}" has been removed from the schedule.`
        : `"${session.title}" has changed: ${parts.join(' and ')}.`,
      data: {
        eventId: String(session.event),
        sessionId: String(session._id),
        kind: removed ? 'session_removed' : 'session_changed',
      },
    });
  });
  emitToEvent(session.event, 'schedule:changed', {
    eventId: session.event,
    sessionId: session._id,
    change: removed ? 'removed' : 'updated',
  });
}

module.exports = { notifyEventCancelled, notifyEventChanged, notifyScheduleChange };