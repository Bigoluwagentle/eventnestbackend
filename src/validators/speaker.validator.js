const { z } = require('zod');
const { httpUrl } = require('./common');

const socialLinks = () =>
  z
    .object({
      twitter: httpUrl().optional().nullable(),
      linkedin: httpUrl().optional().nullable(),
      website: httpUrl().optional().nullable(),
    })
    .optional();

const createSpeakerSchema = z.object({
  params: z.object({ orgId: z.string().min(1) }),
  body: z.object({
    name: z.string().trim().min(1).max(150),
    bio: z.string().max(2000).optional(),
    company: z.string().max(150).optional(),
    jobTitle: z.string().max(150).optional(),
    socialLinks: socialLinks(),
  }),
});

const updateSpeakerSchema = z.object({
  params: z.object({ orgId: z.string().min(1), speakerId: z.string().min(1) }),
  body: z.object({
    name: z.string().trim().min(1).max(150).optional(),
    bio: z.string().max(2000).optional(),
    company: z.string().max(150).optional(),
    jobTitle: z.string().max(150).optional(),
    socialLinks: socialLinks(),
  }),
});

module.exports = { createSpeakerSchema, updateSpeakerSchema };