const { z } = require('zod');

const createAnnouncementSchema = z.object({
  params: z.object({ orgId: z.string().min(1), eventId: z.string().min(1) }),
  body: z.object({
    title: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(1000),
  }),
});

module.exports = { createAnnouncementSchema };