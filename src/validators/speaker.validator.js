const { z } = require('zod');

const createSpeakerSchema = z.object({
  params: z.object({ orgId: z.string().min(1) }),
  body: z.object({
    name: z.string().trim().min(1).max(150),
    bio: z.string().max(2000).optional(),
    company: z.string().max(150).optional(),
    jobTitle: z.string().max(150).optional(),
    socialLinks: z
      .object({
        twitter: z.string().url().optional().nullable(),
        linkedin: z.string().url().optional().nullable(),
        website: z.string().url().optional().nullable(),
      })
      .optional(),
  }),
});

const updateSpeakerSchema = z.object({
  params: z.object({ orgId: z.string().min(1), speakerId: z.string().min(1) }),
  body: z.object({
    name: z.string().trim().min(1).max(150).optional(),
    bio: z.string().max(2000).optional(),
    company: z.string().max(150).optional(),
    jobTitle: z.string().max(150).optional(),
    socialLinks: z
      .object({
        twitter: z.string().url().optional().nullable(),
        linkedin: z.string().url().optional().nullable(),
        website: z.string().url().optional().nullable(),
      })
      .optional(),
    photo: z.object({ url: z.string().url(), publicId: z.string() }).optional(),
  }),
});

module.exports = { createSpeakerSchema, updateSpeakerSchema };