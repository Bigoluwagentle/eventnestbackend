// OpenAPI entries for the platform admin tools and for user reports.

const str = (extra = {}) => ({ type: 'string', ...extra });
const int = (extra = {}) => ({ type: 'integer', ...extra });
const obj = (properties, required) => ({ type: 'object', properties, ...(required ? { required } : {}) });
const arrayOf = (items) => ({ type: 'array', items });
const dateTime = str({ format: 'date-time' });
const objectId = str({ example: '6a8d4376d3adacdfed9a7313' });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const envelope = (data) => obj({ success: { type: 'boolean', example: true }, message: str(), ...(data ? { data: obj(data) } : {}) });
const ok = (description, data) => ({ description, content: json(envelope(data)) });
const response = (name) => ({ $ref: `#/components/responses/${name}` });
const body = (schema, required = true) => ({ required, content: json(schema) });
const errors = (...codes) =>
  Object.fromEntries(codes.map((c) => [String(c), response({ 400: 'BadRequest', 401: 'Unauthorized', 403: 'Forbidden', 404: 'NotFound', 409: 'Conflict', 429: 'TooManyRequests' }[c])]));

const ADMIN_ONLY = 'Requires the platform admin role (super_admin). Promote an account with `node scripts/make-super-admin.js <email>`.';
const pathParam = (name, description) => ({ name, in: 'path', required: true, schema: objectId, description });
const query = (name, schema, description) => ({ name, in: 'query', required: false, schema, ...(description ? { description } : {}) });
const paging = (max = 100, fallback = 20) => [
  query('page', int({ default: 1, minimum: 1 })),
  query('limit', int({ default: fallback, minimum: 1, maximum: max })),
];
const pagination = ref('Pagination');
const security = [{ bearerAuth: [] }];
const reasonBody = (required) =>
  body(obj({ reason: str({ minLength: required ? 5 : 0, maxLength: 500, description: required ? 'Required: why this is being done. Recorded in the audit log.' : 'Optional note for the audit log.' }) }, required ? ['reason'] : undefined), required);

const REPORT_REASONS = ['spam', 'scam', 'inappropriate', 'harassment', 'copyright', 'other'];
const REPORT_STATUS = ['open', 'reviewing', 'resolved', 'dismissed'];

const schemas = {
  AdminOrganization: obj({
    _id: objectId, name: str(), slug: str(), status: str({ enum: ['active', 'suspended'] }),
    isPublic: { type: 'boolean' }, owner: obj({ _id: objectId, name: str(), email: str({ format: 'email' }) }), createdAt: dateTime,
  }),
  AdminUser: obj({
    _id: objectId, name: str(), email: str({ format: 'email' }), role: str({ enum: ['super_admin', 'organizer', 'attendee'] }),
    isActive: { type: 'boolean' }, isEmailVerified: { type: 'boolean' }, createdAt: dateTime,
  }),
  AuditLogEntry: obj({
    _id: objectId, actor: objectId, actorName: str(), action: str({ example: 'organization.suspend' }),
    targetType: str({ enum: ['organization', 'user', 'report'] }), targetId: objectId, targetLabel: str(),
    reason: { type: 'string', nullable: true }, metadata: { type: 'object', additionalProperties: true }, ip: { type: 'string', nullable: true }, createdAt: dateTime,
  }),
  Report: obj({
    _id: objectId, reporter: obj({ _id: objectId, name: str() }), targetType: str({ enum: ['event', 'organization', 'user'] }), targetId: objectId,
    reason: str({ enum: REPORT_REASONS }), details: str(), status: str({ enum: REPORT_STATUS }),
    resolution: { type: 'string', nullable: true }, resolvedAt: { ...dateTime, nullable: true }, createdAt: dateTime,
  }),
};

const paths = {
  '/admin/organizations': {
    get: {
      tags: ['Admin'], summary: 'List organizations', description: ADMIN_ONLY, security,
      parameters: [query('search', str({ maxLength: 100 }), 'Matches name or slug, as plain text.'), query('status', str({ enum: ['active', 'suspended'] })), ...paging()],
      responses: { 200: ok('Organizations', { organizations: arrayOf(ref('AdminOrganization')), pagination }), ...errors(400, 401, 403) },
    },
  },
  '/admin/organizations/{organizationId}/suspend': {
    post: {
      tags: ['Admin'], summary: 'Suspend an organization',
      description:
        `${ADMIN_ONLY} A suspended organization disappears from public pages and discovery, takes no new registrations, and becomes read-only for its own members (every change they try is refused with 403). ` +
        'Its members are notified with the reason. The change and its audit entry are saved together or not at all.',
      security, parameters: [pathParam('organizationId', 'Organization id')], requestBody: reasonBody(true),
      responses: { 200: ok('Suspended', { organization: obj({ _id: objectId, name: str(), slug: str(), status: str() }) }), ...errors(400, 401, 403, 404, 409) },
    },
  },
  '/admin/organizations/{organizationId}/unsuspend': {
    post: {
      tags: ['Admin'], summary: 'Reinstate a suspended organization', description: `${ADMIN_ONLY} Members are notified.`,
      security, parameters: [pathParam('organizationId', 'Organization id')], requestBody: reasonBody(false),
      responses: { 200: ok('Reinstated', { organization: obj({ _id: objectId, name: str(), slug: str(), status: str() }) }), ...errors(400, 401, 403, 404, 409) },
    },
  },
  '/admin/users': {
    get: {
      tags: ['Admin'], summary: 'List accounts',
      description: `${ADMIN_ONLY} Shows email addresses, so it is available to platform admins only. Password hashes and tokens are never included.`, security,
      parameters: [
        query('search', str({ maxLength: 100 }), 'Matches name or email, as plain text.'),
        query('role', str({ enum: ['super_admin', 'organizer', 'attendee'] })),
        query('active', str({ enum: ['true', 'false'] }), 'true or false; leave out for both.'),
        ...paging(),
      ],
      responses: { 200: ok('Accounts', { users: arrayOf(ref('AdminUser')), pagination }), ...errors(400, 401, 403) },
    },
  },
  '/admin/users/{userId}/deactivate': {
    post: {
      tags: ['Admin'], summary: 'Deactivate an account',
      description:
        `${ADMIN_ONLY} The person is signed out everywhere at once (sessions revoked, live connections closed) and cannot log in. You cannot deactivate yourself, and platform admins cannot be deactivated (remove the admin role first).`,
      security, parameters: [pathParam('userId', 'User id')], requestBody: reasonBody(true),
      responses: { 200: ok('Deactivated', { user: obj({ _id: objectId, name: str(), email: str(), isActive: { type: 'boolean' } }) }), ...errors(400, 401, 403, 404, 409) },
    },
  },
  '/admin/users/{userId}/reactivate': {
    post: {
      tags: ['Admin'], summary: 'Reactivate an account', description: `${ADMIN_ONLY} The person has to log in again.`,
      security, parameters: [pathParam('userId', 'User id')], requestBody: reasonBody(false),
      responses: { 200: ok('Reactivated', { user: obj({ _id: objectId, name: str(), email: str(), isActive: { type: 'boolean' } }) }), ...errors(400, 401, 403, 404, 409) },
    },
  },
  '/admin/audit-logs': {
    get: {
      tags: ['Admin'], summary: 'Audit log of admin actions',
      description: `${ADMIN_ONLY} Append-only: entries cannot be edited or deleted. Newest first.`, security,
      parameters: [
        query('action', str({ maxLength: 60, example: 'organization.suspend' })),
        query('targetType', str({ enum: ['organization', 'user', 'report'] })),
        query('targetId', objectId), query('actor', objectId), ...paging(100, 50),
      ],
      responses: { 200: ok('Entries', { entries: arrayOf(ref('AuditLogEntry')), pagination }), ...errors(400, 401, 403) },
    },
  },
  '/admin/reports': {
    get: {
      tags: ['Admin'], summary: 'Abuse reports (moderation queue)', description: `${ADMIN_ONLY} Newest first.`, security,
      parameters: [query('status', str({ enum: REPORT_STATUS })), query('targetType', str({ enum: ['event', 'organization', 'user'] })), ...paging()],
      responses: { 200: ok('Reports', { reports: arrayOf(ref('Report')), pagination }), ...errors(400, 401, 403) },
    },
  },
  '/admin/reports/{reportId}': {
    get: {
      tags: ['Admin'], summary: 'One report and what it is about', description: `${ADMIN_ONLY} \`target\` is null if the reported thing has since been deleted.`, security,
      parameters: [pathParam('reportId', 'Report id')],
      responses: { 200: ok('Report', { report: ref('Report'), target: { type: 'object', nullable: true, additionalProperties: true } }), ...errors(400, 401, 403, 404) },
    },
    patch: {
      tags: ['Admin'], summary: 'Move a report along or close it',
      description:
        `${ADMIN_ONLY} open → reviewing → resolved or dismissed (open can also be closed directly). A closed report is final. Closing needs a short note on what was decided. Every change is audited. Acting on the reported thing (for example suspending an organization) is a separate step.`,
      security, parameters: [pathParam('reportId', 'Report id')],
      requestBody: body(obj({ status: str({ enum: ['reviewing', 'resolved', 'dismissed'] }), resolution: str({ maxLength: 1000, description: 'Required (3+ characters) for resolved and dismissed.' }) }, ['status'])),
      responses: { 200: ok('Updated', { report: obj({ _id: objectId, status: str(), resolution: { type: 'string', nullable: true }, resolvedAt: { ...dateTime, nullable: true } }) }), ...errors(400, 401, 403, 404, 409) },
    },
  },
  '/reports': {
    post: {
      tags: ['Reports'], summary: 'Report an event, organization or person',
      description:
        'Any logged-in user. You can only report what you can see (anything else answers 404), and not yourself. One open report per person per target: a second one answers 409 while the first is still open or being reviewed. Limited to 10 reports per hour.',
      security,
      requestBody: body(obj({ targetType: str({ enum: ['event', 'organization', 'user'] }), targetId: objectId, reason: str({ enum: REPORT_REASONS }), details: str({ maxLength: 1000 }) }, ['targetType', 'targetId', 'reason'])),
      responses: { 201: ok('Sent', { report: obj({ _id: objectId, status: str(), createdAt: dateTime }) }), ...errors(400, 401, 404, 409, 429) },
    },
  },
};

const tags = [{ name: 'Reports', description: 'Reporting abuse' }];

module.exports = { schemas, paths, tags };