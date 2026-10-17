const { z } = require('zod');
const { objectId } = require('./common');

const orgEvent = { orgId: objectId(), eventId: objectId() };
const optionalText = (max) => z.string().trim().max(max).optional();

// Resource links: https only, no embedded credentials, and a real host name.
// This rejects javascript:, data:, http:, localhost and anything that is not a URL.
const httpsUrl = () =>
  z
    .string()
    .trim()
    .max(2000)
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.');
      } catch {
        return false;
      }
    }, 'Must be a valid https:// link');

const listGallerySchema = z.object({
  params: z.object(orgEvent),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(24),
    type: z.enum(['photo', 'video', 'resource']).optional(),
  }),
});

const updateSettingsSchema = z.object({
  params: z.object(orgEvent),
  body: z.object({ access: z.enum(['private', 'attendees', 'public']) }),
});

const uploadTicketsSchema = z.object({
  params: z.object(orgEvent),
  body: z.object({ count: z.number().int().min(1).max(20).default(1) }),
});

const attachPhotosSchema = z.object({
  params: z.object(orgEvent),
  body: z.object({
    photos: z
      .array(z.object({ publicId: z.string().trim().min(1).max(300), caption: optionalText(500) }))
      .min(1)
      .max(20),
  }),
});

const addVideoSchema = z.object({
  params: z.object(orgEvent),
  body: z.object({
    url: z.string().trim().min(1).max(300),
    title: optionalText(150),
    caption: optionalText(500),
  }),
});

const addResourceSchema = z.object({
  params: z.object(orgEvent),
  body: z.object({
    title: z.string().trim().min(1).max(150),
    url: httpsUrl(),
    description: optionalText(500),
  }),
});

const updateItemSchema = z.object({
  params: z.object({ ...orgEvent, itemId: objectId() }),
  body: z
    .object({ title: optionalText(150), caption: optionalText(500) })
    .refine((body) => Object.keys(body).length > 0, 'Provide a title or a caption to update'),
});

const itemIdSchema = z.object({
  params: z.object({ ...orgEvent, itemId: objectId() }),
});

const slug = () => z.string().trim().min(1).max(200);

const publicGallerySchema = z.object({
  params: z.object({ orgSlug: slug(), eventSlug: slug() }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(60).default(24),
    type: z.enum(['photo', 'video', 'resource']).optional(),
  }),
});

module.exports = {
  listGallerySchema,
  updateSettingsSchema,
  uploadTicketsSchema,
  attachPhotosSchema,
  addVideoSchema,
  addResourceSchema,
  updateItemSchema,
  itemIdSchema,
  publicGallerySchema,
};