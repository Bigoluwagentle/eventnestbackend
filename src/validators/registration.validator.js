const { z } = require('zod');

const registerSchema = z.object({
  body: z.object({
    eventId: z.string().min(1),
    ticketTypeId: z.string().min(1),
    // when the ticket is sold out: true puts you on the waiting list instead of answering "sold out"
    joinWaitlist: z.boolean().default(false),
  }),
});

module.exports = { registerSchema };