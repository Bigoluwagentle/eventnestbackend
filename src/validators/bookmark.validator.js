const { z } = require('zod');

const addBookmarkSchema = z.object({
  body: z.object({
    sessionId: z.string().min(1),
  }),
});

module.exports = { addBookmarkSchema };