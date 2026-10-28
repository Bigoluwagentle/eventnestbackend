const { z } = require('zod');
const { objectId } = require('./common');

const page = () => z.coerce.number().int().min(1).default(1);
const limit = (max = 100, fallback = 20) => z.coerce.number().int().min(1).max(max).default(fallback);
const searchText = () => z.string().trim().max(100).optional();

const listOrganizationsSchema = z.object({
  query: z.object({
    search: searchText(),
    status: z.enum(['active', 'suspended']).optional(),
    page: page(),
    limit: limit(),
  }),
});

const listUsersSchema = z.object({
  query: z.object({
    search: searchText(),
    role: z.enum(['super_admin', 'organizer', 'attendee']).optional(),
    // the query string is text, so "false" must not be treated as true
    active: z.enum(['true', 'false']).optional().transform((value) => (value === undefined ? undefined : value === 'true')),
    page: page(),
    limit: limit(),
  }),
});

// a suspension or deactivation needs a stated reason; reversing one does not
const requiredReason = () => z.string().trim().min(5, 'Give a reason (at least 5 characters)').max(500);
const optionalReason = () => z.string().trim().max(500).optional();

const organizationAction = (reason) =>
  z.object({ params: z.object({ organizationId: objectId() }), body: z.object({ reason }) });
const userAction = (reason) => z.object({ params: z.object({ userId: objectId() }), body: z.object({ reason }) });

const suspendOrganizationSchema = organizationAction(requiredReason());
const unsuspendOrganizationSchema = organizationAction(optionalReason());
const deactivateUserSchema = userAction(requiredReason());
const reactivateUserSchema = userAction(optionalReason());

const listAuditLogsSchema = z.object({
  query: z.object({
    action: z.string().trim().max(60).optional(),
    targetType: z.enum(['organization', 'user', 'report']).optional(),
    targetId: objectId().optional(),
    actor: objectId().optional(),
    page: page(),
    limit: limit(100, 50),
  }),
});

const listReportsSchema = z.object({
  query: z.object({
    status: z.enum(['open', 'reviewing', 'resolved', 'dismissed']).optional(),
    targetType: z.enum(['event', 'organization', 'user']).optional(),
    page: page(),
    limit: limit(),
  }),
});

const reportIdSchema = z.object({ params: z.object({ reportId: objectId() }) });

const updateReportSchema = z.object({
  params: z.object({ reportId: objectId() }),
  body: z
    .object({
      status: z.enum(['reviewing', 'resolved', 'dismissed']),
      resolution: z.string().trim().max(1000).optional(),
    })
    // closing a report needs a note on what was decided
    .refine((body) => body.status === 'reviewing' || (body.resolution && body.resolution.length >= 3), {
      message: 'Add a short note on what was decided',
      path: ['resolution'],
    }),
});

module.exports = {
  listOrganizationsSchema,
  listUsersSchema,
  suspendOrganizationSchema,
  unsuspendOrganizationSchema,
  deactivateUserSchema,
  reactivateUserSchema,
  listAuditLogsSchema,
  listReportsSchema,
  reportIdSchema,
  updateReportSchema,
};