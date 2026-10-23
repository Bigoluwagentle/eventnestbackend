const Event = require('../models/Event');
const Session = require('../models/Session');
const AppError = require('../utils/AppError');
const { generateUniqueSlug } = require('../utils/slugify');
const { escapeRegex } = require('../utils/escapeRegex');
const { assertInventoryFitsCapacity } = require('./ticketType.service');
const { deleteEventCascade } = require('./eventCleanup.service');
const { notifyEventCancelled, notifyEventChanged } = require('./eventNotifier.service');
const { undiscoverableOrganizationIds } = require('../utils/orgVisibility');

const VALID_TRANSITIONS = {
  draft: ['published', 'cancelled'],
  published: ['registration_closed', 'ongoing', 'cancelled'],
  registration_closed: ['ongoing', 'cancelled', 'published'],
  ongoing: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function assertPublishRequirements(event) {
  const errors = [];
  if (!event.name) errors.push('Event name is required');
  if (!event.startDate || !event.endDate) errors.push('Start and end dates are required');
  if (!event.category) errors.push('Category is required');

  if (event.eventType === 'physical' && !event.location?.venueName) {
    errors.push('Venue name is required for physical events');
  }
  if (event.eventType === 'virtual' && !event.virtualLink) {
    errors.push('Virtual link is required for virtual events');
  }
  if (event.eventType === 'hybrid' && (!event.location?.venueName || !event.virtualLink)) {
    errors.push('Both venue and virtual link are required for hybrid events');
  }

  if (errors.length) {
    throw new AppError('Cannot publish event: missing required fields', 400, errors);
  }
}

async function createEvent(organization, userId, data) {
  const slug = await generateUniqueSlug(data.name, async (candidate) => {
    const existing = await Event.findOne({ organization: organization._id, slug: candidate });
    return !!existing;
  });

  const event = await Event.create({ ...data, organization: organization._id, slug, createdBy: userId });
  return event;
}

async function listOrgEvents(organizationId, { status, page = 1, limit = 20 }) {
  const filter = { organization: organizationId };
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [events, total] = await Promise.all([
    Event.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Event.countDocuments(filter),
  ]);

  return { events, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

const placeOf = (event) =>
  JSON.stringify([
    (event.location && event.location.venueName) || null,
    (event.location && event.location.address) || null,
    (event.location && event.location.city) || null,
    (event.location && event.location.country) || null,
  ]);

// the changes attendees need to hear about, as readable labels
function attendeeFacingChanges(before, event) {
  const changes = [];
  if (before.start !== +event.startDate || before.end !== +event.endDate || before.timezone !== event.timezone) {
    changes.push('date and time');
  }
  if (before.place !== placeOf(event)) changes.push('location');
  if (before.eventType !== event.eventType) changes.push('format (in person / online)');
  if (before.virtualLink !== (event.virtualLink || null)) changes.push('online joining link');
  return changes;
}

async function updateEvent(event, updates) {
  if (['completed', 'cancelled'].includes(event.status)) {
    throw new AppError(`Cannot edit an event that is ${event.status}`, 400);
  }

  // check the dates as they will be AFTER the update (a change to just one of them can still be wrong)
  const start = updates.startDate || event.startDate;
  const end = updates.endDate || event.endDate;
  if (end < start) throw new AppError('End date must be after start date', 400);

  // lowering the capacity below the tickets already on offer would leave the event over-sold on paper
  if (updates.capacity) await assertInventoryFitsCapacity(event._id, updates.capacity);

  const before = {
    start: +event.startDate,
    end: +event.endDate,
    timezone: event.timezone,
    place: placeOf(event),
    eventType: event.eventType,
    virtualLink: event.virtualLink || null,
  };

  // `location` is merged field by field: assigning it whole would wipe the parts that were not sent
  const { location, ...rest } = updates;
  Object.assign(event, rest);
  if (location) {
    const { coordinates, ...place } = location;
    Object.entries(place).forEach(([key, value]) => event.set(`location.${key}`, value));
    if (coordinates) {
      Object.entries(coordinates).forEach(([key, value]) => event.set(`location.coordinates.${key}`, value));
    }
  }
  await event.save();

  // a draft has no attendees; for everything else, tell them what changed
  if (event.status !== 'draft') {
    const changes = attendeeFacingChanges(before, event);
    if (changes.length) await notifyEventChanged(event, changes);
  }

  return event;
}

async function updateEventStatus(event, newStatus) {
  const allowed = VALID_TRANSITIONS[event.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(`Cannot transition event from "${event.status}" to "${newStatus}"`, 400);
  }
  if (newStatus === 'published') {
    assertPublishRequirements(event);
  }
  event.status = newStatus;
  await event.save();
  if (newStatus === 'cancelled') await notifyEventCancelled(event);
  return event;
}

async function deleteEvent(event) {
  if (event.status !== 'draft') {
    throw new AppError('Only draft events can be deleted. Cancel published events instead.', 400);
  }
  await deleteEventCascade(event);
}

async function listPublicEvents({ page = 1, limit = 12, category, eventType, city, search, sort = 'upcoming' }) {
  const filter = { status: 'published', visibility: 'public', startDate: { $gte: new Date() } };
  if (category) filter.category = category;
  if (eventType) filter.eventType = eventType;
  if (city) filter['location.city'] = new RegExp(escapeRegex(city), 'i');
  if (search) filter.name = new RegExp(escapeRegex(search), 'i');


  const hiddenOrganizations = await undiscoverableOrganizationIds();
  if (hiddenOrganizations.length) filter.organization = { $nin: hiddenOrganizations };

  const sortOption = sort === 'newest' ? { createdAt: -1 } : { startDate: 1 };
  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    Event.find(filter).select('-virtualLink -createdBy').sort(sortOption).skip(skip).limit(limit).populate('organization', 'name slug logo'),
    Event.countDocuments(filter),
  ]);

  return { events, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function getPublicEventBySlug(orgSlug, eventSlug) {
  const Organization = require('../models/Organization');
  const organization = await Organization.findOne({ slug: orgSlug, status: 'active' });
  if (!organization) throw new AppError('Event not found', 404);

  const event = await Event.findOne({
    organization: organization._id,
    slug: eventSlug,
    visibility: { $in: ['public', 'unlisted'] },
    status: { $nin: ['draft', 'cancelled'] },
  }).select('-virtualLink -createdBy').populate('organization', 'name slug logo');

  if (!event) throw new AppError('Event not found', 404);
  return event;
}

async function getPublicSchedule(orgSlug, eventSlug) {
  const event = await getPublicEventBySlug(orgSlug, eventSlug);
  const sessions = await Session.find({ event: event._id })
    .sort({ startTime: 1 })
    .populate('speakers', 'name photo company jobTitle socialLinks');
  return { event, sessions };
}

async function getPublicEventSpeakers(orgSlug, eventSlug) {
  const event = await getPublicEventBySlug(orgSlug, eventSlug);
  const sessions = await Session.find({ event: event._id }).populate(
    'speakers',
    'name photo bio company jobTitle socialLinks'
  );

  // dedupe speakers across sessions
  const speakerMap = new Map();
  sessions.forEach((s) => {
    s.speakers.forEach((sp) => speakerMap.set(sp._id.toString(), sp));
  });

  return Array.from(speakerMap.values());
}

module.exports = {
  createEvent,
  listOrgEvents,
  updateEvent,
  updateEventStatus,
  deleteEvent,
  listPublicEvents,
  getPublicEventBySlug,
  getPublicSchedule,
  getPublicEventSpeakers,
};