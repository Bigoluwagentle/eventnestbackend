const { z } = require('zod');
const { httpUrl } = require('./common');

const isValidTimeZone = (name) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: name }); // eslint-disable-line no-new
    return true;
  } catch {
    return false;
  }
};
const timeZone = () => z.string().trim().max(60).refine(isValidTimeZone, 'Unknown time zone (use a name like Africa/Lagos)');

const place = () => z.string().trim().max(200).optional().nullable();
const locationSchema = z.object({
  venueName: place(),
  address: place(),
  city: place(),
  country: place(),
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90).optional().nullable(),
      lng: z.number().min(-180).max(180).optional().nullable(),
    })
    .optional(),
});

const CATEGORY_ENUM = [
  'conference', 'tech', 'hackathon', 'meetup', 'workshop', 'concert',
  'corporate', 'school', 'church', 'festival', 'community', 'other',
];

const tags = () => z.array(z.string().trim().min(1).max(40)).max(20);

const createEventSchema = z.object({
  params: z.object({ orgId: z.string().min(1) }),
  body: z
    .object({
      name: z.string().trim().min(3).max(150),
      description: z.string().max(10000).optional(),
      shortDescription: z.string().max(300).optional(),
      category: z.enum(CATEGORY_ENUM),
      tags: tags().optional(),
      eventType: z.enum(['physical', 'virtual', 'hybrid']),
      location: locationSchema.optional(),
      virtualLink: httpUrl().optional().nullable(),
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      timezone: timeZone().default('UTC'),
      capacity: z.number().int().positive().optional().nullable(),
      visibility: z.enum(['public', 'unlisted', 'private']).default('public'),
      registrationDeadline: z.coerce.date().optional().nullable(),
    })
    .refine((data) => data.endDate >= data.startDate, {
      message: 'End date must be after start date',
      path: ['endDate'],
    }),
});

const updateEventSchema = z.object({
  params: z.object({ orgId: z.string().min(1), eventId: z.string().min(1) }),
  body: z.object({
    name: z.string().trim().min(3).max(150).optional(),
    description: z.string().max(10000).optional(),
    shortDescription: z.string().max(300).optional(),
    category: z.enum(CATEGORY_ENUM).optional(),
    tags: tags().optional(),
    eventType: z.enum(['physical', 'virtual', 'hybrid']).optional(),
    location: locationSchema.optional(),
    virtualLink: httpUrl().optional().nullable(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    timezone: timeZone().optional(),
    capacity: z.number().int().positive().optional().nullable(),
    visibility: z.enum(['public', 'unlisted', 'private']).optional(),
    registrationDeadline: z.coerce.date().optional().nullable(),
  }),
});

const updateStatusSchema = z.object({
  params: z.object({ orgId: z.string().min(1), eventId: z.string().min(1) }),
  body: z.object({
    status: z.enum(['draft', 'published', 'registration_closed', 'ongoing', 'completed', 'cancelled']),
  }),
});

const listPublicEventsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(12),
    category: z.enum(CATEGORY_ENUM).optional(),
    eventType: z.enum(['physical', 'virtual', 'hybrid']).optional(),
    city: z.string().trim().max(100).optional(),
    search: z.string().trim().max(100).optional(),
    sort: z.enum(['upcoming', 'newest']).default('upcoming'),
  }),
});

const listOrgEventsSchema = z.object({
  params: z.object({ orgId: z.string().min(1) }),
  query: z.object({
    status: z.enum(['draft', 'published', 'registration_closed', 'ongoing', 'completed', 'cancelled']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

module.exports = {
  createEventSchema,
  updateEventSchema,
  updateStatusSchema,
  listPublicEventsSchema,
  listOrgEventsSchema,
};