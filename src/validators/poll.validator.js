const { z } = require('zod');

const createPollSchema = z.object({
  params: z.object({ orgId: z.string().min(1), eventId: z.string().min(1) }),
  body: z.object({
    question: z.string().trim().min(1).max(300),
    options: z.array(z.string().trim().min(1).max(150)).min(2).max(10),
    isAnonymous: z.boolean().default(false),
    openImmediately: z.boolean().default(true),
  }),
});

const updatePollStatusSchema = z.object({
  params: z.object({ orgId: z.string().min(1), eventId: z.string().min(1), pollId: z.string().min(1) }),
  body: z.object({
    status: z.enum(['open', 'closed']),
  }),
});

const voteSchema = z.object({
  params: z.object({ orgId: z.string().min(1), eventId: z.string().min(1), pollId: z.string().min(1) }),
  body: z.object({
    optionId: z.string().min(1),
  }),
});

module.exports = { createPollSchema, updatePollStatusSchema, voteSchema };