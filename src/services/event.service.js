const Event = require('../models/Event');
const AppError = require('../utils/AppError');
const { generateUniqueSlug } = require('../utils/slugify');

// Which status transitions are allowed - enforced here, not left to the client
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

  const event = await Event.create({
    ...data,
    organization: organization._id,
    slug,
    createdBy: userId,
  });

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

async function updateEvent(event, updates) {
  if (['completed', 'cancelled'].includes(event.status)) {
    throw new AppError(`Cannot edit an event that is ${event.status}`, 400);
  }
  Object.assign(event, updates);
  await event.save();
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
  return event;
}

async function deleteEvent(event) {
  if (event.status !== 'draft') {
    throw new AppError('Only draft events can be deleted. Cancel published events instead.', 400);
  }
  await event.deleteOne();
}

async function listPublicEvents({ page = 1, limit = 12, category, eventType, city, search, sort = 'upcoming' }) {
  const filter = {
    status: 'published',
    visibility: 'public',
    startDate: { $gte: new Date() },
  };
  if (category) filter.category = category;
  if (eventType) filter.eventType = eventType;
  if (city) filter['location.city'] = new RegExp(city, 'i');
  if (search) filter.name = new RegExp(search, 'i');

  const sortOption = sort === 'newest' ? { createdAt: -1 } : { startDate: 1 };
  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    Event.find(filter).sort(sortOption).skip(skip).limit(limit).populate('organization', 'name slug logo'),
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
  }).populate('organization', 'name slug logo');

  if (!event) throw new AppError('Event not found', 404);
  return event;
}

module.exports = {
  createEvent,
  listOrgEvents,
  updateEvent,
  updateEventStatus,
  deleteEvent,
  listPublicEvents,
  getPublicEventBySlug,
};