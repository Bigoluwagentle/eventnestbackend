const { z } = require('zod');

const addStaffSchema = z.object({
  params: z.object({ orgId: z.string().min(1), eventId: z.string().min(1) }),
  body: z.object({
    email: z.string().trim().email(),
    permissions: z
      .array(z.enum(['check_in', 'view_attendees', 'manage_schedule', 'send_announcements', 'manage_questions', 'view_analytics']))
      .min(1)
      .default(['check_in']),
  }),
});

const updateStaffPermissionsSchema = z.object({
  params: z.object({ orgId: z.string().min(1), eventId: z.string().min(1), staffId: z.string().min(1) }),
  body: z.object({
    permissions: z
      .array(z.enum(['check_in', 'view_attendees', 'manage_schedule', 'send_announcements', 'manage_questions', 'view_analytics']))
      .min(1),
  }),
});

const checkInSchema = z.object({
  params: z.object({ orgId: z.string().min(1), eventId: z.string().min(1) }),
  body: z.object({
    ticketId: z.string().min(1),
    token: z.string().min(1),
  }),
});

module.exports = { addStaffSchema, updateStaffPermissionsSchema, checkInSchema };