const { z } = require('zod');

const createTicketTypeSchema = z.object({
  params: z.object({ orgId: z.string().min(1), eventId: z.string().min(1) }),
  body: z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(500).optional(),
    price: z.number().min(0).default(0),
    currency: z.string().default('USD'),
    quantity: z.number().int().positive(),
    salesStart: z.coerce.date().optional().nullable(),
    salesEnd: z.coerce.date().optional().nullable(),
    purchaseLimit: z.number().int().positive().default(10),
  }),
});

const updateTicketTypeSchema = z.object({
  params: z.object({ orgId: z.string().min(1), eventId: z.string().min(1), ticketTypeId: z.string().min(1) }),
  body: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    price: z.number().min(0).optional(),
    currency: z.string().optional(),
    quantity: z.number().int().positive().optional(),
    salesStart: z.coerce.date().optional().nullable(),
    salesEnd: z.coerce.date().optional().nullable(),
    purchaseLimit: z.number().int().positive().optional(),
    isActive: z.boolean().optional(),
  }),
});

module.exports = { createTicketTypeSchema, updateTicketTypeSchema };