const { z } = require('zod');

const createOrganizationSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(150),
    description: z.string().max(1000).optional(),
    website: z.string().url().optional(),
  }),
});

const updateOrganizationSchema = z.object({
  params: z.object({ orgId: z.string().min(1) }),
  body: z.object({
    name: z.string().trim().min(2).max(150).optional(),
    description: z.string().max(1000).optional(),
    website: z.string().url().optional(),
    socialLinks: z
      .object({
        twitter: z.string().url().optional().nullable(),
        linkedin: z.string().url().optional().nullable(),
        instagram: z.string().url().optional().nullable(),
        facebook: z.string().url().optional().nullable(),
      })
      .optional(),
  }),
});

const inviteMemberSchema = z.object({
  params: z.object({ orgId: z.string().min(1) }),
  body: z.object({
    email: z.string().trim().email(),
    role: z.enum(['admin', 'manager']).default('manager'),
  }),
});

const acceptInvitationSchema = z.object({
  body: z.object({
    token: z.string().min(1),
  }),
});

const updateMemberRoleSchema = z.object({
  params: z.object({ orgId: z.string().min(1), memberId: z.string().min(1) }),
  body: z.object({
    role: z.enum(['admin', 'manager']),
  }),
});

const transferOwnershipSchema = z.object({
  params: z.object({ orgId: z.string().min(1) }),
  body: z.object({
    newOwnerUserId: z.string().min(1),
  }),
});

module.exports = {
  createOrganizationSchema,
  updateOrganizationSchema,
  inviteMemberSchema,
  acceptInvitationSchema,
  updateMemberRoleSchema,
  transferOwnershipSchema,
};