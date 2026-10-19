const { z } = require('zod');
const { objectId } = require('./common');

const listNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    // the query string is text: without this, "false" would count as true
    unreadOnly: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  }),
});

const notificationIdSchema = z.object({
  params: z.object({ notificationId: objectId() }),
});

module.exports = { listNotificationsSchema, notificationIdSchema };