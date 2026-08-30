const { z } = require('zod');

const registerSchema = z.object({
  body: z.object({
    eventId: z.string().min(1),
    ticketTypeId: z.string().min(1),
  }),
});

module.exports = { registerSchema };