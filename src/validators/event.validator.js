const { z } = require('zod');

const locationSchema = z.object({
  venueName: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  coordinates: z
    .object({ lat: z.number().optional().nullable(), lng: z.number().optional().nullable() })
    .optional(),
});

const CATEGORY_ENUM = [
  'conference', 'tech', 'hackathon', 'meetup', 'workshop', 'concert',
  'corporate', 'school', 'church', 'festival', 'community', 'other',
];

const createEventSchema = z.object({
  params: z.object({ orgId: z.string().min(1) }),
  body: z
    .object({
      name: z.string().trim().min(3).max(150),
      description: z.string().max(10000).optional(),
      shortDescription: z.string().max(300).optional(),
      category: z.enum(CATEGORY_ENUM),
      tags: z.array(z.string()).optional(),
      eventType: z.enum(['physical', 'virtual', 'hybrid']),
      location: locationSchema.optional(),
      virtualLink: z.string().url().optional().nullable(),
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      timezone: z.string().default('UTC'),
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
    tags: z.array(z.string()).optional(),
    eventType: z.enum(['physical', 'virtual', 'hybrid']).optional(),
    location: locationSchema.optional(),
    virtualLink: z.string().url().optional().nullable(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    timezone: z.string().optional(),
    capacity: z.number().int().positive().optional().nullable(),
    visibility: z.enum(['public', 'unlisted', 'private']).optional(),
    registrationDeadline: z.coerce.date().optional().nullable(),
    banner: z
      .object({ url: z.string().url(), publicId: z.string() })
      .optional(),
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
    city: z.string().optional(),
    search: z.string().optional(),
    sort: z.enum(['upcoming', 'newest']).default('upcoming'),
  }),
});

module.exports = {
  createEventSchema,
  updateEventSchema,
  updateStatusSchema,
  listPublicEventsSchema,
};