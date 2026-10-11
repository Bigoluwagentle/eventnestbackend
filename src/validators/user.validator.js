const { z } = require('zod');
const { httpUrl, objectId, strongPassword } = require('./common');

const tagList = () =>
  z
    .array(z.string().trim().min(1).max(40))
    .max(20)
    .transform((items) => [...new Set(items)]);

const nonEmpty = (obj) => Object.keys(obj).length > 0;

const updateProfileSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(100).optional(),
      bio: z.string().trim().max(500).optional(),
      phone: z
        .string()
        .trim()
        .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Invalid phone number')
        .nullable()
        .optional(),
      socialLinks: z
        .object({
          twitter: httpUrl().nullable().optional(),
          linkedin: httpUrl().nullable().optional(),
          website: httpUrl().nullable().optional(),
        })
        .optional(),
      interests: tagList().optional(),
      skills: tagList().optional(),
    })
    .refine(nonEmpty, 'Provide at least one field to update'),
});

const updatePrivacySchema = z.object({
  body: z
    .object({
      showEmail: z.boolean().optional(),
      showPhone: z.boolean().optional(),
      showSocialLinks: z.boolean().optional(),
      showInterestsAndSkills: z.boolean().optional(),
    })
    .refine(nonEmpty, 'Provide at least one setting to update'),
});

const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: strongPassword(),
    })
    .refine((d) => d.currentPassword !== d.newPassword, {
      message: 'New password must be different from the current password',
      path: ['newPassword'],
    }),
});

const userIdParamSchema = z.object({
  params: z.object({ userId: objectId() }),
});

module.exports = { updateProfileSchema, updatePrivacySchema, changePasswordSchema, userIdParamSchema };