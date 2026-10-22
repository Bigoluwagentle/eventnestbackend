// OpenAPI entries added by the lifecycle changes. These add or replace single methods on paths the
// main spec already has (see mergePaths in openapi.js), so the member and organization docs stay in one place.

const str = (extra = {}) => ({ type: 'string', ...extra });
const obj = (properties) => ({ type: 'object', properties });
const uri = str({ format: 'uri' });
const objectId = str({ example: '6a8d4376d3adacdfed9a7313' });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const envelope = (data) => obj({ success: { type: 'boolean', example: true }, message: str(), ...(data ? { data: obj(data) } : {}) });
const ok = (description, data) => ({ description, content: json(envelope(data)) });
const response = (name) => ({ $ref: `#/components/responses/${name}` });
const param = (name) => ({ $ref: `#/components/parameters/${name}` });
const socialLinks = obj(Object.fromEntries(['twitter', 'linkedin', 'instagram', 'facebook'].map((k) => [k, { ...uri, nullable: true }])));
const errors = (...codes) => Object.fromEntries(codes.map((c) => [String(c), response({ 400: 'BadRequest', 401: 'Unauthorized', 403: 'Forbidden', 404: 'NotFound' }[c])]));

const paths = {
  '/organizations/{orgId}': {
    patch: {
      tags: ['Organizations'],
      summary: 'Update organization details',
      description:
        'Requires org role: owner or admin. Links must be http(s). `isPublic: false` takes the organization out of public discovery: its events no longer appear in GET /events and its page (GET /organizations/slug/{slug}) shows only to members. ' +
        'It is not a privacy lock: events remain reachable by their direct link, like unlisted events.',
      security: [{ bearerAuth: [] }],
      parameters: [param('orgId')],
      requestBody: {
        required: true,
        content: json(obj({
          name: str(), description: str(), website: uri, socialLinks,
          isPublic: { type: 'boolean', description: 'Whether the organization is listed publicly.' },
        })),
      },
      responses: { 200: ok('Updated', { organization: ref('Organization') }), ...errors(400, 401, 403, 404) },
    },
  },
  '/organizations/slug/{slug}': {
    get: {
      tags: ['Organizations'],
      summary: 'Find an organization by slug',
      description: 'A logged-in user can look up active, publicly listed organizations. An organization with `isPublic: false` looks nonexistent (404) to everyone except its members.',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'slug', in: 'path', required: true, schema: str() }],
      responses: { 200: ok('Organization', { organization: ref('Organization') }), ...errors(401, 404) },
    },
  },
  '/organizations/{orgId}/members/{memberId}': {
    patch: {
      tags: ['Organizations'],
      summary: "Change a member's role",
      description:
        "Requires org role: owner. Only `admin` and `manager` can be assigned here. The owner's role cannot be changed this way: use transfer-ownership. The member must belong to this organization.",
      security: [{ bearerAuth: [] }],
      parameters: [param('orgId'), param('memberId')],
      requestBody: { required: true, content: json({ ...obj({ role: str({ enum: ['admin', 'manager'] }) }), required: ['role'] }) },
      responses: {
        200: ok('Role updated', { member: ref('OrganizationMember') }),
        ...errors(400, 401, 403, 404),
      },
    },
  },
  '/organizations/{orgId}/events/{eventId}': {
    delete: {
      tags: ['Events'],
      summary: 'Delete a draft event and everything attached to it',
      description:
        'Requires org role: owner or admin. Only drafts can be deleted (cancel published events instead), and an event that has registrations is refused. ' +
        'Its ticket types, sessions and bookmarks, polls and votes, questions and votes, announcements, event staff, gallery items and hosted photos are all removed together in one transaction (hosted images right afterwards).',
      security: [{ bearerAuth: [] }],
      parameters: [param('orgId'), param('eventId')],
      responses: { 200: ok('Deleted'), ...errors(400, 401, 403, 404) },
    },
  },
};

module.exports = { schemas: {}, paths, tags: [] };