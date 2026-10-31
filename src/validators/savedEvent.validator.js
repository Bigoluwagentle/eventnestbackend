const { z } = require('zod');
const { objectId } = require('./common');

const eventIdSchema = z.object({ params: z.object({ eventId: objectId() }) });

const listSavedSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    // the query string is text: "false" must not count as true
    upcoming: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  }),
});

// ?eventIds=id1,id2,id3 (up to 50, all valid ids)
const savedStatusSchema = z.object({
  query: z.object({
    eventIds: z
      .string()
      .min(1)
      .max(2000)
      .transform((value) => value.split(',').map((id) => id.trim()).filter(Boolean))
      .pipe(z.array(objectId()).min(1).max(50)),
  }),
});

module.exports = { eventIdSchema, listSavedSchema, savedStatusSchema };