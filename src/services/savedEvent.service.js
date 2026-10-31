const SavedEvent = require('../models/SavedEvent');
const Event = require('../models/Event');
const Organization = require('../models/Organization');
const AppError = require('../utils/AppError');

const MAX_SAVED_PER_USER = 500;

// Only events anyone could find publicly can be saved or listed: public or unlisted, not a draft or
// cancelled, and from an active organization. Anything else looks exactly like it does not exist.
async function findDiscoverableEvent(eventId) {
  const event = await Event.findById(eventId).select('status visibility organization');
  if (!event || !['public', 'unlisted'].includes(event.visibility) || ['draft', 'cancelled'].includes(event.status)) {
    return null;
  }
  const organization = await Organization.findById(event.organization).select('status');
  return organization && organization.status === 'active' ? event : null;
}

/** Idempotent: saving something already saved is fine. */
async function saveEvent(userId, eventId) {
  if (!(await findDiscoverableEvent(eventId))) throw new AppError('Event not found', 404);

  if (!(await SavedEvent.exists({ user: userId, event: eventId }))) {
    if ((await SavedEvent.countDocuments({ user: userId })) >= MAX_SAVED_PER_USER) {
      throw new AppError(`You can save at most ${MAX_SAVED_PER_USER} events. Remove some first.`, 400);
    }
    try {
      await SavedEvent.create({ user: userId, event: eventId });
    } catch (err) {
      // a double tap: another request saved it a moment ago, which is exactly the outcome we wanted
      if (err.code !== 11000) throw err;
    }
  }
  return { saved: true };
}

/** Idempotent, and answers the same whether or not it was saved (no way to probe for events). */
async function unsaveEvent(userId, eventId) {
  await SavedEvent.deleteOne({ user: userId, event: eventId });
  return { saved: false };
}

function summarize(event, savedAt, now) {
  return {
    _id: event._id,
    name: event.name,
    slug: event.slug,
    shortDescription: event.shortDescription,
    category: event.category,
    eventType: event.eventType,
    startDate: event.startDate,
    endDate: event.endDate,
    timezone: event.timezone,
    city: (event.location && event.location.city) || null,
    country: (event.location && event.location.country) || null,
    banner: { url: (event.banner && event.banner.url) || null },
    status: event.status,
    organization: { name: event.organization.name, slug: event.organization.slug, logo: { url: (event.organization.logo && event.organization.logo.url) || null } },
    savedAt,
    isPast: new Date(event.endDate) < now,
  };
}

/** Newest saves first. Events that are no longer visible quietly drop out (the save is kept). */
async function listSavedEvents(userId, { page, limit, upcoming }) {
  const saved = await SavedEvent.find({ user: userId }).sort({ createdAt: -1, _id: -1 }).lean();
  const ids = saved.map((s) => s.event);

  const events = ids.length
    ? await Event.find({ _id: { $in: ids }, status: { $nin: ['draft', 'cancelled'] }, visibility: { $in: ['public', 'unlisted'] } })
        .select('name slug shortDescription category eventType startDate endDate timezone location.city location.country banner.url status organization')
        .populate('organization', 'name slug logo status')
        .lean()
    : [];
  const byId = new Map(events.map((e) => [String(e._id), e]));

  const now = new Date();
  let items = saved
    .map((s) => ({ event: byId.get(String(s.event)), savedAt: s.createdAt }))
    .filter(({ event }) => event && event.organization && event.organization.status === 'active')
    .map(({ event, savedAt }) => summarize(event, savedAt, now));
  if (upcoming) items = items.filter((item) => !item.isPast);

  const total = items.length;
  return {
    events: items.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

/** Which of these events has this person saved? One request for a whole page of cards. */
async function savedAmong(userId, eventIds) {
  const saved = await SavedEvent.distinct('event', { user: userId, event: { $in: eventIds } });
  return { saved: saved.map(String) };
}

module.exports = { saveEvent, unsaveEvent, listSavedEvents, savedAmong, MAX_SAVED_PER_USER };