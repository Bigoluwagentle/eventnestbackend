const { z } = require('zod');

const createSessionSchema = z.object({
  params: z.object({ orgId: z.string().min(1), eventId: z.string().min(1) }),
  body: z
    .object({
      title: z.string().trim().min(1).max(200),
      description: z.string().max(3000).optional(),
      type: z.enum(['keynote', 'workshop', 'session', 'panel', 'break']).default('session'),
      startTime: z.coerce.date(),
      endTime: z.coerce.date(),
      location: z.string().max(200).optional(),
      capacity: z.number().int().positive().optional().nullable(),
      speakers: z.array(z.string()).optional().default([]),
    })
    .refine((data) => data.endTime > data.startTime, {
      message: 'End time must be after start time',
      path: ['endTime'],
    }),
});

const updateSessionSchema = z.object({
  params: z.object({ orgId: z.string().min(1), eventId: z.string().min(1), sessionId: z.string().min(1) }),
  body: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(3000).optional(),
    type: z.enum(['keynote', 'workshop', 'session', 'panel', 'break']).optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    location: z.string().max(200).optional(),
    capacity: z.number().int().positive().optional().nullable(),
    speakers: z.array(z.string()).optional(),
  }),
});

module.exports = { createSessionSchema, updateSessionSchema };