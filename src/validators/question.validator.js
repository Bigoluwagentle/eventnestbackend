const { z } = require('zod');

const askQuestionSchema = z.object({
  params: z.object({ orgId: z.string().min(1), eventId: z.string().min(1) }),
  body: z.object({
    text: z.string().trim().min(3).max(500),
  }),
});

const listQuestionsSchema = z.object({
  params: z.object({ orgId: z.string().min(1), eventId: z.string().min(1) }),
  query: z.object({
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
});

const updateQuestionStatusSchema = z.object({
  params: z.object({ orgId: z.string().min(1), eventId: z.string().min(1), questionId: z.string().min(1) }),
  body: z.object({
    status: z.enum(['approved', 'hidden', 'answered']),
  }),
});

module.exports = { askQuestionSchema, listQuestionsSchema, updateQuestionStatusSchema };