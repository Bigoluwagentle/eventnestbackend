// Hand-written OpenAPI 3.0 spec for the EventNest API.
// Served by Swagger UI at /api/docs and as raw JSON at /api/docs/openapi.json.
const analyticsDocs = require('./analytics.docs');

const CATEGORIES = [
  'conference', 'tech', 'hackathon', 'meetup', 'workshop', 'concert',
  'corporate', 'school', 'church', 'festival', 'community', 'other',
];
const EVENT_TYPES = ['physical', 'virtual', 'hybrid'];
const VISIBILITY = ['public', 'unlisted', 'private'];
const EVENT_STATUS = ['draft', 'published', 'registration_closed', 'ongoing', 'completed', 'cancelled'];
const STAFF_PERMISSIONS = [
  'check_in', 'view_attendees', 'manage_schedule', 'send_announcements', 'manage_questions', 'view_analytics',
];
const SESSION_TYPES = ['keynote', 'workshop', 'session', 'panel', 'break'];

// ---------- small builders ----------
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const param = (name) => ({ $ref: `#/components/parameters/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const body = (schema) => ({ required: true, content: json(schema) });
const arrayOf = (items) => ({ type: 'array', items });
const str = (extra = {}) => ({ type: 'string', ...extra });
const nstr = (extra = {}) => ({ type: 'string', nullable: true, ...extra });
const obj = (properties, required) => ({ type: 'object', properties, ...(required ? { required } : {}) });
const query = (name, schema, description) => ({
  name, in: 'query', required: false, schema, ...(description ? { description } : {}),
});

const objectId = str({ example: '6a8d4376d3adacdfed9a7313' });
const dateTime = str({ format: 'date-time' });
const uri = str({ format: 'uri' });
const email = str({ format: 'email' });

const envelope = (data) =>
  obj({
    success: { type: 'boolean', example: true },
    message: str(),
    ...(data ? { data: obj(data) } : {}),
  });
const ok = (description, data) => ({ description, content: json(envelope(data)) });

const ERROR_NAMES = {
  400: 'BadRequest', 401: 'Unauthorized', 403: 'Forbidden', 404: 'NotFound', 409: 'Conflict', 429: 'TooManyRequests',
};

function op({ tag, summary, description, auth = true, params, requestBody, status = 200, response, errors = [] }) {
  const codes = [...new Set([...(auth ? [401] : []), ...errors])];
  return {
    tags: [tag],
    summary,
    ...(description ? { description } : {}),
    ...(auth ? { security: [{ bearerAuth: [] }] } : {}),
    ...(params ? { parameters: params } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses: {
      [status]: response,
      ...Object.fromEntries(codes.map((c) => [String(c), { $ref: `#/components/responses/${ERROR_NAMES[c]}` }])),
    },
  };
}

// permission notes reused in descriptions
const MEMBER = 'Requires organization membership.';
const MANAGE = 'Requires org role: owner, admin or manager.';
const ADMIN = 'Requires org role: owner or admin.';
const OWNER = 'Requires org role: owner.';
const PARTICIPANT =
  'Requires being a confirmed attendee of the event, event staff, or a member of the organization.';
const staffOr = (permission) =>
  `Requires org role owner/admin/manager, or event staff with the "${permission}" permission.`;

const orgEvent = [param('orgId'), param('eventId')];

// ---------- schemas ----------
const eventProps = {
  _id: objectId,
  organization: objectId,
  name: str(),
  slug: str(),
  description: str(),
  shortDescription: str(),
  category: str({ enum: CATEGORIES }),
  tags: arrayOf(str()),
  banner: obj({ url: nstr({ format: 'uri' }), publicId: nstr() }),
  eventType: str({ enum: EVENT_TYPES }),
  location: obj({
    venueName: nstr(),
    address: nstr(),
    city: nstr(),
    country: nstr(),
    coordinates: obj({ lat: { type: 'number', nullable: true }, lng: { type: 'number', nullable: true } }),
  }),
  virtualLink: nstr({ format: 'uri' }),
  startDate: dateTime,
  endDate: dateTime,
  timezone: str({ example: 'Africa/Lagos', description: 'IANA time zone, for display. All dates are stored in UTC.' }),
  capacity: { type: 'integer', nullable: true },
  visibility: str({ enum: VISIBILITY }),
  registrationDeadline: { ...dateTime, nullable: true },
  status: str({ enum: EVENT_STATUS }),
  createdBy: objectId,
  createdAt: dateTime,
  updatedAt: dateTime,
};
// public responses never include the join link or the creator id
const { virtualLink, createdBy, ...publicEventProps } = eventProps; // eslint-disable-line no-unused-vars

const eventInputProps = {
  name: str({ minLength: 3, maxLength: 150 }),
  description: str({ maxLength: 10000 }),
  shortDescription: str({ maxLength: 300 }),
  category: str({ enum: CATEGORIES }),
  tags: arrayOf(str()),
  eventType: str({ enum: EVENT_TYPES }),
  location: eventProps.location,
  virtualLink: nstr({ format: 'uri' }),
  startDate: dateTime,
  endDate: { ...dateTime, description: 'Must not be before startDate.' },
  timezone: str({ default: 'UTC' }),
  capacity: { type: 'integer', minimum: 1, nullable: true },
  visibility: str({ enum: VISIBILITY, default: 'public' }),
  registrationDeadline: { ...dateTime, nullable: true },
};

const socialLinks = (keys) => obj(Object.fromEntries(keys.map((k) => [k, nstr({ format: 'uri' })])));

const schemas = {
  Error: obj({
    success: { type: 'boolean', example: false },
    message: str(),
    details: { type: 'array', items: {}, description: 'Field-level validation problems, when applicable.' },
  }),
  Pagination: obj({
    page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, pages: { type: 'integer' },
  }),
  User: obj({
    _id: objectId,
    name: str(),
    email,
    role: str({ enum: ['super_admin', 'organizer', 'attendee'] }),
    avatar: obj({ url: nstr({ format: 'uri' }), publicId: nstr() }),
    bio: str(),
    phone: nstr(),
    socialLinks: socialLinks(['twitter', 'linkedin', 'website']),
    interests: arrayOf(str()),
    skills: arrayOf(str()),
    privacy: obj({
      showEmail: { type: 'boolean' },
      showPhone: { type: 'boolean' },
      showSocialLinks: { type: 'boolean' },
      showInterestsAndSkills: { type: 'boolean' },
    }),
    isEmailVerified: { type: 'boolean' },
    isActive: { type: 'boolean' },
    createdAt: dateTime,
    updatedAt: dateTime,
  }),
  PublicUser: obj({
    _id: objectId,
    name: str(),
    avatar: obj({ url: nstr({ format: 'uri' }) }),
    bio: str(),
    email: { ...email, description: 'Only present if the user allows it.' },
    phone: { ...str(), description: 'Only present if the user allows it.' },
    socialLinks: socialLinks(['twitter', 'linkedin', 'website']),
    interests: arrayOf(str()),
    skills: arrayOf(str()),
  }),
  Organization: obj({
    _id: objectId,
    name: str(),
    slug: str(),
    description: str(),
    logo: obj({ url: nstr({ format: 'uri' }), publicId: nstr() }),
    website: nstr({ format: 'uri' }),
    socialLinks: socialLinks(['twitter', 'linkedin', 'instagram', 'facebook']),
    owner: objectId,
    settings: obj({ isPublic: { type: 'boolean' } }),
    status: str({ enum: ['active', 'suspended'] }),
    createdAt: dateTime,
    updatedAt: dateTime,
  }),
  OrganizationMember: obj({
    _id: objectId,
    organization: objectId,
    user: obj({ _id: objectId, name: str(), email, avatar: obj({ url: nstr() }) }),
    role: str({ enum: ['owner', 'admin', 'manager'] }),
    joinedAt: dateTime,
  }),
  Event: obj(eventProps),
  PublicEvent: obj({
    ...publicEventProps,
    organization: obj({ _id: objectId, name: str(), slug: str(), logo: obj({ url: nstr() }) }),
  }),
  EventInput: obj(eventInputProps, ['name', 'category', 'eventType', 'startDate', 'endDate']),
  TicketType: obj({
    _id: objectId,
    event: objectId,
    name: str(),
    description: str(),
    price: { type: 'number', description: '0 means a free ticket.' },
    currency: str({ example: 'USD' }),
    quantity: { type: 'integer', description: 'Total inventory.' },
    quantitySold: { type: 'integer' },
    remaining: { type: 'integer' },
    salesStart: { ...dateTime, nullable: true },
    salesEnd: { ...dateTime, nullable: true },
    purchaseLimit: { type: 'integer' },
    isActive: { type: 'boolean' },
  }),
  PublicTicketType: obj({
    _id: objectId,
    name: str(),
    description: str(),
    price: { type: 'number' },
    currency: str(),
    remaining: { type: 'integer' },
    soldOut: { type: 'boolean' },
    onSale: { type: 'boolean', description: 'Inside its sales window and not sold out.' },
    salesStart: { ...dateTime, nullable: true },
    salesEnd: { ...dateTime, nullable: true },
    purchaseLimit: { type: 'integer' },
  }),
  Registration: obj({
    _id: objectId,
    event: objectId,
    user: objectId,
    ticketType: objectId,
    quantity: { type: 'integer' },
    status: str({ enum: ['pending_payment', 'confirmed', 'cancelled', 'waitlisted'] }),
    amountDue: { type: 'number' },
    cancelledAt: { ...dateTime, nullable: true },
    createdAt: dateTime,
  }),
  Ticket: obj({
    _id: objectId,
    event: objectId,
    registration: objectId,
    ticketType: objectId,
    user: objectId,
    ticketNumber: str({ example: 'ENT-3F94E425', description: 'Human-readable reference. Not used for validation.' }),
    status: str({ enum: ['valid', 'used', 'cancelled', 'refunded'] }),
    checkedInAt: { ...dateTime, nullable: true },
    checkedInBy: { ...objectId, nullable: true },
  }),
  Speaker: obj({
    _id: objectId,
    organization: objectId,
    name: str(),
    photo: obj({ url: nstr({ format: 'uri' }), publicId: nstr() }),
    bio: str(),
    company: str(),
    jobTitle: str(),
    socialLinks: socialLinks(['twitter', 'linkedin', 'website']),
  }),
  Session: obj({
    _id: objectId,
    event: objectId,
    title: str(),
    description: str(),
    type: str({ enum: SESSION_TYPES }),
    startTime: dateTime,
    endTime: dateTime,
    location: str(),
    capacity: { type: 'integer', nullable: true },
    speakers: arrayOf(ref('Speaker')),
  }),
  Announcement: obj({
    _id: objectId, event: objectId, title: str(), message: str(), createdBy: objectId, createdAt: dateTime,
  }),
  Notification: obj({
    _id: objectId,
    type: str({ enum: ['registration_confirmed', 'event_reminder', 'schedule_changed', 'announcement', 'general'] }),
    title: str(),
    message: str(),
    data: { type: 'object', additionalProperties: true },
    isRead: { type: 'boolean' },
    createdAt: dateTime,
  }),
  Poll: obj({
    _id: objectId,
    event: objectId,
    question: str(),
    status: str({ enum: ['draft', 'open', 'closed'] }),
    isAnonymous: { type: 'boolean' },
    options: arrayOf(obj({ _id: objectId, text: str(), voteCount: { type: 'integer' } })),
    totalVotes: { type: 'integer' },
    myVote: { ...objectId, nullable: true, description: 'Option id the current user voted for.' },
  }),
  Question: obj({
    _id: objectId,
    event: objectId,
    text: str(),
    status: str({ enum: ['approved', 'hidden', 'answered'] }),
    upvoteCount: { type: 'integer' },
    hasUpvoted: { type: 'boolean' },
    isMine: { type: 'boolean' },
    author: obj({ _id: objectId, name: str() }),
    createdAt: dateTime,
  }),
};

const errorResponse = (description) => ({ description, content: json(ref('Error')) });

const components = {
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Access token from /auth/login or /auth/signup. Lasts 15 minutes. Paste the token only, without "Bearer ".',
    },
  },
  parameters: Object.fromEntries(
    [
      ['orgId', 'Organization id'], ['eventId', 'Event id'], ['speakerId', 'Speaker id'],
      ['sessionId', 'Session id'], ['ticketTypeId', 'Ticket type id'], ['staffId', 'Event staff record id'],
      ['pollId', 'Poll id'], ['questionId', 'Question id'], ['memberId', 'Organization member record id'],
      ['userId', 'User id'], ['registrationId', 'Registration id'], ['notificationId', 'Notification id'],
    ].map(([name, description]) => [name, { name, in: 'path', required: true, description, schema: objectId }])
  ),
  responses: {
    BadRequest: errorResponse('Validation failed or the request is not allowed in the current state.'),
    Unauthorized: errorResponse('Missing, invalid or expired access token.'),
    Forbidden: errorResponse('Authenticated, but not allowed to do this.'),
    NotFound: errorResponse('The resource does not exist (or is not visible to you).'),
    Conflict: errorResponse('The request conflicts with current state, e.g. duplicate or sold out.'),
    TooManyRequests: errorResponse('Rate limit exceeded.'),
  },
  schemas,
};

const orgSlugEventSlug = [
  { name: 'orgSlug', in: 'path', required: true, schema: str(), description: 'Organization slug' },
  { name: 'eventSlug', in: 'path', required: true, schema: str(), description: 'Event slug' },
];

const authData = { user: ref('User'), accessToken: str() };
const pwRule = 'At least 8 characters with an upper-case letter, a lower-case letter and a number.';

// ---------- paths ----------
const paths = {
  // ===== Auth =====
  '/auth/signup': {
    post: op({
      tag: 'Auth', summary: 'Create an account', auth: false,
      description: `Signs the user in immediately: the access token is in the body and the ...refresh token is set as an httpOnly cookie. A verification email is sent. Rate limited (20 per hour per IP). Password: ${pwRule}`,
      requestBody: body(obj({ name: str({ minLength: 2, maxLength: 100 }), email, password: str({ format: 'password' }) }, ['name', 'email', 'password'])),
      status: 201, response: ok('Account created', authData), errors: [400, 409, 429],
    }),
  },
  '/auth/login': {
    post: op({
      tag: 'Auth', summary: 'Log in', auth: false,
      description: 'Rate limited (10 attempts per 15 minutes per IP). Sets the refresh cookie.',
      requestBody: body(obj({ email, password: str({ format: 'password' }) }, ['email', 'password'])),
      response: ok('Logged in', authData), errors: [400, 401, 429],
    }),
  },
  '/auth/refresh': {
    post: op({
      tag: 'Auth', summary: 'Rotate the refresh token and get a new access token', auth: false,
      description:
        'Reads the httpOnly refresh cookie. The previous refresh token is revoked; reusing an old one revokes every session of that user. Requires the custom header `X-Requested-With: XMLHttpRequest` (CSRF defense).',
      params: [{ name: 'X-Requested-With', in: 'header', required: true, schema: str({ enum: ['XMLHttpRequest'] }) }],
      response: ok('Token refreshed', authData), errors: [401, 403],
    }),
  },
  '/auth/logout': {
    post: op({
      tag: 'Auth', summary: 'Log out (revokes the current refresh token)', auth: false,
      params: [{ name: 'X-Requested-With', in: 'header', required: true, schema: str({ enum: ['XMLHttpRequest'] }) }],
      response: ok('Logged out'), errors: [403],
    }),
  },
  '/auth/forgot-password': {
    post: op({
      tag: 'Auth', summary: 'Request a password reset', auth: false,
      description: 'Always answers the same way, whether or not the email exists. Rate limited; a repeat request within a minute of the last one is ignored. The reset link is emailed and is valid for 15 minutes.',
      requestBody: body(obj({ email }, ['email'])),
      response: ok('Request accepted'), errors: [400, 429],
    }),
  },
  '/auth/reset-password': {
    post: op({
      tag: 'Auth', summary: 'Set a new password with a reset token', auth: false,
      description: `Signs out every existing session. Password: ${pwRule}`,
      requestBody: body(obj({ token: str(), password: str({ format: 'password' }) }, ['token', 'password'])),
      response: ok('Password reset'), errors: [400, 429],
    }),
  },
  '/auth/verify-email/{token}': {
    get: op({
      tag: 'Auth', summary: 'Verify an email address', auth: false,
      params: [{ name: 'token', in: 'path', required: true, schema: str() }],
      response: ok('Email verified'), errors: [400],
    }),
  },
  '/auth/resend-verification': {
    post: op({
      tag: 'Auth', summary: 'Send the verification email again',
      description: 'For the logged-in user. Rate limited (5 per hour), and only one email per minute per account. 400 if the email is already verified.',
      response: ok('Verification email sent'), errors: [400, 429],
    }),
  },
  '/auth/me': {
    get: op({ tag: 'Auth', summary: 'Current user', response: ok('Current user', { user: ref('User') }) }),
  },

  // ===== Users =====
  '/users/me': {
    get: op({ tag: 'Users', summary: 'Get my profile', response: ok('My profile', { user: ref('User') }) }),
    patch: op({
      tag: 'Users', summary: 'Update my profile',
      description: 'Only the listed fields can be changed. Role, email and avatar cannot be changed here (use /uploads for the avatar).',
      requestBody: body(obj({
        name: str({ minLength: 2, maxLength: 100 }),
        bio: str({ maxLength: 500 }),
        phone: nstr(),
        socialLinks: socialLinks(['twitter', 'linkedin', 'website']),
        interests: arrayOf(str()),
        skills: arrayOf(str()),
      })),
      response: ok('Profile updated', { user: ref('User') }), errors: [400],
    }),
  },
  '/users/me/privacy': {
    patch: op({
      tag: 'Users', summary: 'Choose what other attendees can see',
      description: 'Email and phone are hidden from others by default.',
      requestBody: body(obj({
        showEmail: { type: 'boolean' }, showPhone: { type: 'boolean' },
        showSocialLinks: { type: 'boolean' }, showInterestsAndSkills: { type: 'boolean' },
      })),
      response: ok('Privacy updated', { user: ref('User') }), errors: [400],
    }),
  },
  '/users/me/change-password': {
    post: op({
      tag: 'Users', summary: 'Change my password',
      description: 'Rate limited. Signs out every session, so log in again afterwards.',
      requestBody: body(obj({ currentPassword: str({ format: 'password' }), newPassword: str({ format: 'password' }) }, ['currentPassword', 'newPassword'])),
      response: ok('Password changed'), errors: [400, 429],
    }),
  },
  '/users/{userId}': {
    get: op({
      tag: 'Users', summary: "View another attendee's public profile",
      description: 'Visible only if you and that user both have a confirmed registration for a common event; otherwise 404. Fields the user hid are omitted.',
      params: [param('userId')],
      response: ok('Profile', { user: ref('PublicUser') }), errors: [404],
    }),
  },

  // ===== Organizations =====
  '/organizations': {
    post: op({
      tag: 'Organizations', summary: 'Create an organization (you become its owner)',
      requestBody: body(obj({ name: str({ minLength: 2, maxLength: 150 }), description: str(), website: uri }, ['name'])),
      status: 201, response: ok('Created', { organization: ref('Organization') }), errors: [400],
    }),
  },
  '/organizations/me': {
    get: op({
      tag: 'Organizations', summary: 'Organizations I belong to',
      response: ok('My organizations', {
        organizations: arrayOf(obj({ organization: ref('Organization'), role: str(), joinedAt: dateTime })),
      }),
    }),
  },
  '/organizations/slug/{slug}': {
    get: op({
      tag: 'Organizations', summary: 'Find an organization by slug',
      params: [{ name: 'slug', in: 'path', required: true, schema: str() }],
      response: ok('Organization', { organization: ref('Organization') }), errors: [404],
    }),
  },
  '/organizations/accept-invite': {
    post: op({
      tag: 'Organizations', summary: 'Accept an organization invitation',
      description: 'The logged-in account must use the email the invitation was sent to.',
      requestBody: body(obj({ token: str() }, ['token'])),
      response: ok('Joined', { membership: ref('OrganizationMember') }), errors: [400, 403, 409],
    }),
  },
  '/organizations/{orgId}': {
    patch: op({
      tag: 'Organizations', summary: 'Update organization details', description: ADMIN,
      params: [param('orgId')],
      requestBody: body(obj({
        name: str(), description: str(), website: uri,
        socialLinks: socialLinks(['twitter', 'linkedin', 'instagram', 'facebook']),
      })),
      response: ok('Updated', { organization: ref('Organization') }), errors: [400, 403, 404],
    }),
  },
  '/organizations/{orgId}/members': {
    get: op({
      tag: 'Organizations', summary: 'List members', description: MEMBER,
      params: [param('orgId')],
      response: ok('Members', { members: arrayOf(ref('OrganizationMember')) }), errors: [403, 404],
    }),
  },
  '/organizations/{orgId}/invite': {
    post: op({
      tag: 'Organizations', summary: 'Invite someone to the organization',       description: `${ADMIN} The invitation is sent by email and is valid for 7 days.`,
      params: [param('orgId')],
      requestBody: body(obj({ email, role: str({ enum: ['admin', 'manager'], default: 'manager' }) }, ['email'])),
      status: 201, response: ok('Invitation created'), errors: [400, 403, 404, 409],
    }),
  },
  '/organizations/{orgId}/members/{memberId}': {
    delete: op({
      tag: 'Organizations', summary: 'Remove a member', description: `${ADMIN} The owner cannot be removed.`,
      params: [param('orgId'), param('memberId')],
      response: ok('Removed'), errors: [400, 403, 404],
    }),
  },
  '/organizations/{orgId}/leave': {
    post: op({
      tag: 'Organizations', summary: 'Leave the organization', description: `${MEMBER} The owner must transfer ownership first.`,
      params: [param('orgId')],
      response: ok('Left'), errors: [400, 403, 404],
    }),
  },
  '/organizations/{orgId}/transfer-ownership': {
    post: op({
      tag: 'Organizations', summary: 'Transfer ownership to another member', description: OWNER,
      params: [param('orgId')],
      requestBody: body(obj({ newOwnerUserId: objectId }, ['newOwnerUserId'])),
      response: ok('Transferred', { organization: ref('Organization') }), errors: [400, 403, 404],
    }),
  },

  // ===== Speakers =====
  '/organizations/{orgId}/speakers': {
    post: op({
      tag: 'Speakers', summary: 'Add a speaker (reusable across the organization\'s events)', description: MANAGE,
      params: [param('orgId')],
      requestBody: body(obj({
        name: str({ maxLength: 150 }), bio: str(), company: str(), jobTitle: str(),
        socialLinks: socialLinks(['twitter', 'linkedin', 'website']),
      }, ['name'])),
      status: 201, response: ok('Created', { speaker: ref('Speaker') }), errors: [400, 403],
    }),
    get: op({
      tag: 'Speakers', summary: 'List speakers', description: MEMBER,
      params: [param('orgId')],
      response: ok('Speakers', { speakers: arrayOf(ref('Speaker')) }), errors: [403],
    }),
  },
  '/organizations/{orgId}/speakers/{speakerId}': {
    patch: op({
      tag: 'Speakers', summary: 'Update a speaker', description: `${MANAGE} Photos are set through /uploads.`,
      params: [param('orgId'), param('speakerId')],
      requestBody: body(obj({
        name: str(), bio: str(), company: str(), jobTitle: str(),
        socialLinks: socialLinks(['twitter', 'linkedin', 'website']),
      })),
      response: ok('Updated', { speaker: ref('Speaker') }), errors: [400, 403, 404],
    }),
    delete: op({
      tag: 'Speakers', summary: 'Delete a speaker', description: `${ADMIN} Fails if the speaker is assigned to a session.`,
      params: [param('orgId'), param('speakerId')],
      response: ok('Deleted'), errors: [400, 403, 404],
    }),
  },

  // ===== Events (management) =====
  '/organizations/{orgId}/events': {
    post: op({
      tag: 'Events', summary: 'Create an event (starts as a draft)', description: MANAGE,
      params: [param('orgId')], requestBody: body(ref('EventInput')),
      status: 201, response: ok('Created', { event: ref('Event') }), errors: [400, 403],
    }),
    get: op({
      tag: 'Events', summary: "List the organization's events, drafts included", description: MANAGE,
      params: [
        param('orgId'),
        query('status', str({ enum: EVENT_STATUS })),
        query('page', { type: 'integer', default: 1 }),
        query('limit', { type: 'integer', default: 20 }),
      ],
      response: ok('Events', { events: arrayOf(ref('Event')), pagination: ref('Pagination') }), errors: [403],
    }),
  },
  '/organizations/{orgId}/events/{eventId}': {
    get: op({
      tag: 'Events', summary: 'Get an event (management view, includes the join link)',
      description: 'Requires org membership or being event staff.',
      params: orgEvent, response: ok('Event', { event: ref('Event') }), errors: [403, 404],
    }),
    patch: op({
      tag: 'Events', summary: 'Update an event', description: `${MANAGE} Completed or cancelled events cannot be edited. Banners are set through /uploads.`,
      params: orgEvent,
      requestBody: body(obj({ ...eventInputProps, name: str({ minLength: 3, maxLength: 150 }) })),
      response: ok('Updated', { event: ref('Event') }), errors: [400, 403, 404],
    }),
    delete: op({
      tag: 'Events', summary: 'Delete a draft event', description: `${ADMIN} Only drafts can be deleted; cancel published events instead.`,
      params: orgEvent, response: ok('Deleted'), errors: [400, 403, 404],
    }),
  },
  '/organizations/{orgId}/events/{eventId}/status': {
    patch: op({
      tag: 'Events', summary: 'Move an event through its lifecycle',
      description:
        `${MANAGE} Allowed: draft→published|cancelled; published→registration_closed|ongoing|cancelled; registration_closed→published|ongoing|cancelled; ongoing→completed|cancelled. Publishing requires a venue (physical), a virtual link (virtual) or both (hybrid).`,
      params: orgEvent,
      requestBody: body(obj({ status: str({ enum: EVENT_STATUS }) }, ['status'])),
      response: ok('Status updated', { event: ref('Event') }), errors: [400, 403, 404],
    }),
  },

  // ===== Ticket types =====
  '/organizations/{orgId}/events/{eventId}/ticket-types': {
    post: op({
      tag: 'Ticket Types', summary: 'Create a ticket type', description: MANAGE,
      params: orgEvent,
      requestBody: body(obj({
        name: str({ maxLength: 100 }), description: str({ maxLength: 500 }),
        price: { type: 'number', minimum: 0, default: 0 }, currency: str({ default: 'USD' }),
        quantity: { type: 'integer', minimum: 1 },
        salesStart: { ...dateTime, nullable: true }, salesEnd: { ...dateTime, nullable: true },
        purchaseLimit: { type: 'integer', default: 10 },
      }, ['name', 'quantity'])),
      status: 201, response: ok('Created', { ticketType: ref('TicketType') }), errors: [400, 403, 404],
    }),
    get: op({
      tag: 'Ticket Types', summary: 'List ticket types (management view)',
      description: 'Requires org membership or event staff. Org members also see inactive ticket types. Attendees use the public endpoint instead.',
      params: orgEvent, response: ok('Ticket types', { ticketTypes: arrayOf(ref('TicketType')) }), errors: [403, 404],
    }),
  },
  '/organizations/{orgId}/events/{eventId}/ticket-types/{ticketTypeId}': {
    patch: op({
      tag: 'Ticket Types', summary: 'Update a ticket type', description: `${MANAGE} Quantity cannot go below what is already sold.`,
      params: [...orgEvent, param('ticketTypeId')],
      requestBody: body(obj({
        name: str(), description: str(), price: { type: 'number', minimum: 0 }, currency: str(),
        quantity: { type: 'integer', minimum: 1 }, salesStart: { ...dateTime, nullable: true },
        salesEnd: { ...dateTime, nullable: true }, purchaseLimit: { type: 'integer' }, isActive: { type: 'boolean' },
      })),
      response: ok('Updated', { ticketType: ref('TicketType') }), errors: [400, 403, 404],
    }),
    delete: op({
      tag: 'Ticket Types', summary: 'Delete a ticket type', description: `${ADMIN} Fails once tickets have been sold; deactivate instead.`,
      params: [...orgEvent, param('ticketTypeId')], response: ok('Deleted'), errors: [400, 403, 404],
    }),
  },

  // ===== Event staff =====
  '/organizations/{orgId}/events/{eventId}/staff': {
    post: op({
      tag: 'Event Staff', summary: 'Give someone event-specific permissions', description: `${MANAGE} The person needs an EventNest account but does not have to be an organization member.`,
      params: orgEvent,
      requestBody: body(obj({
        email, permissions: arrayOf(str({ enum: STAFF_PERMISSIONS })),
      }, ['email'])),
      status: 201, response: ok('Staff added'), errors: [400, 403, 404, 409],
    }),
    get: op({
      tag: 'Event Staff', summary: 'List event staff', description: MANAGE,
      params: orgEvent, response: ok('Staff'), errors: [403, 404],
    }),
  },
  '/organizations/{orgId}/events/{eventId}/staff/{staffId}': {
    patch: op({
      tag: 'Event Staff', summary: "Replace a staff member's permissions", description: MANAGE,
      params: [...orgEvent, param('staffId')],
      requestBody: body(obj({ permissions: arrayOf(str({ enum: STAFF_PERMISSIONS })) }, ['permissions'])),
      response: ok('Updated'), errors: [400, 403, 404],
    }),
    delete: op({
      tag: 'Event Staff', summary: 'Remove a staff member', description: MANAGE,
      params: [...orgEvent, param('staffId')], response: ok('Removed'), errors: [403, 404],
    }),
  },

  // ===== Check-in =====
  '/organizations/{orgId}/events/{eventId}/check-in/scan': {
    post: op({
      tag: 'Check-in', summary: 'Validate a scanned QR code and check the attendee in',
      description:
        `${staffOr('check_in')} The QR code encodes {ticketId, token}. The token is verified server-side, and the check-in is an atomic update, so a ticket can only be checked in once even if two scanners scan it simultaneously (second scan gets 409).`,
      params: orgEvent,
      requestBody: body(obj({ ticketId: objectId, token: str() }, ['ticketId', 'token'])),
      response: ok('Checked in', { ticket: ref('Ticket') }), errors: [400, 403, 404, 409],
    }),
  },
  '/organizations/{orgId}/events/{eventId}/check-in/attendees': {
    get: op({
      tag: 'Check-in', summary: 'List tickets / attendees', description: staffOr('view_attendees'),
      params: orgEvent, response: ok('Attendees', { attendees: arrayOf(ref('Ticket')) }), errors: [403, 404],
    }),
  },

  // ===== Sessions =====
  '/organizations/{orgId}/events/{eventId}/sessions': {
    post: op({
      tag: 'Sessions', summary: 'Add a schedule item',
      description: `${staffOr('manage_schedule')} Must fall within the event's start and end dates. Speakers must belong to the organization.`,
      params: orgEvent,
      requestBody: body(obj({
        title: str({ maxLength: 200 }), description: str(), type: str({ enum: SESSION_TYPES, default: 'session' }),
        startTime: dateTime, endTime: dateTime, location: str(),
        capacity: { type: 'integer', nullable: true }, speakers: arrayOf(objectId),
      }, ['title', 'startTime', 'endTime'])),
      status: 201, response: ok('Created', { session: ref('Session') }), errors: [400, 403, 404],
    }),
    get: op({
      tag: 'Sessions', summary: 'List schedule items (staff view)', description: 'Requires org membership or event staff. Attendees use the public schedule endpoint.',
      params: orgEvent, response: ok('Sessions', { sessions: arrayOf(ref('Session')) }), errors: [403, 404],
    }),
  },
  '/organizations/{orgId}/events/{eventId}/sessions/{sessionId}': {
    patch: op({
      tag: 'Sessions', summary: 'Update a schedule item', description: staffOr('manage_schedule'),
      params: [...orgEvent, param('sessionId')],
      requestBody: body(obj({
        title: str(), description: str(), type: str({ enum: SESSION_TYPES }), startTime: dateTime, endTime: dateTime,
        location: str(), capacity: { type: 'integer', nullable: true }, speakers: arrayOf(objectId),
      })),
      response: ok('Updated', { session: ref('Session') }), errors: [400, 403, 404],
    }),
    delete: op({
      tag: 'Sessions', summary: 'Delete a schedule item', description: staffOr('manage_schedule'),
      params: [...orgEvent, param('sessionId')], response: ok('Deleted'), errors: [403, 404],
    }),
  },

  // ===== Announcements =====
  '/organizations/{orgId}/events/{eventId}/announcements': {
    post: op({
      tag: 'Announcements', summary: 'Send an announcement',
      description: `${staffOr('send_announcements')} Saved, delivered as an in-app notification to every confirmed attendee, and pushed live over Socket.IO (event \`announcement:new\`).`,
      params: orgEvent,
      requestBody: body(obj({ title: str({ maxLength: 200 }), message: str({ maxLength: 1000 }) }, ['title', 'message'])),
      status: 201, response: ok('Sent', { announcement: ref('Announcement') }), errors: [400, 403, 404],
    }),
    get: op({
      tag: 'Announcements', summary: 'List announcements', description: PARTICIPANT,
      params: orgEvent, response: ok('Announcements', { announcements: arrayOf(ref('Announcement')) }), errors: [403, 404],
    }),
  },

  // ===== Polls =====
  '/organizations/{orgId}/events/{eventId}/polls': {
    post: op({
      tag: 'Polls', summary: 'Create a poll', description: `${staffOr('manage_questions')} Opens immediately unless openImmediately is false. Anonymous polls never expose who voted.`,
      params: orgEvent,
      requestBody: body(obj({
        question: str({ maxLength: 300 }), options: { type: 'array', minItems: 2, maxItems: 10, items: str() },
        isAnonymous: { type: 'boolean', default: false }, openImmediately: { type: 'boolean', default: true },
      }, ['question', 'options'])),
      status: 201, response: ok('Created', { poll: ref('Poll') }), errors: [400, 403, 404],
    }),
    get: op({
      tag: 'Polls', summary: 'List polls (drafts only visible to org members)', description: PARTICIPANT,
      params: orgEvent, response: ok('Polls', { polls: arrayOf(ref('Poll')) }), errors: [403, 404],
    }),
  },
  '/organizations/{orgId}/events/{eventId}/polls/{pollId}': {
    get: op({
      tag: 'Polls', summary: 'Get a poll with live counts', description: PARTICIPANT,
      params: [...orgEvent, param('pollId')], response: ok('Poll', { poll: ref('Poll') }), errors: [403, 404],
    }),
  },
  '/organizations/{orgId}/events/{eventId}/polls/{pollId}/vote': {
    post: op({
      tag: 'Polls', summary: 'Vote in an open poll',
      description: `${PARTICIPANT} One vote per user, enforced by the database (second vote gets 409). Live results are pushed as \`poll:updated\`.`,
      params: [...orgEvent, param('pollId')],
      requestBody: body(obj({ optionId: objectId }, ['optionId'])),
      response: ok('Vote recorded', { poll: ref('Poll') }), errors: [400, 403, 404, 409],
    }),
  },
  '/organizations/{orgId}/events/{eventId}/polls/{pollId}/status': {
    patch: op({
      tag: 'Polls', summary: 'Open or close a poll', description: `${staffOr('manage_questions')} draft→open, open→closed.`,
      params: [...orgEvent, param('pollId')],
      requestBody: body(obj({ status: str({ enum: ['open', 'closed'] }) }, ['status'])),
      response: ok('Updated', { poll: ref('Poll') }), errors: [400, 403, 404],
    }),
  },

  // ===== Q&A =====
  '/organizations/{orgId}/events/{eventId}/questions': {
    post: op({
      tag: 'Q&A', summary: 'Ask a question',
      description: `${PARTICIPANT} Live immediately (pushed as \`question:new\`). Max 10 questions per user per event; closed once the event is draft, cancelled or completed. Askers are not shown to other attendees.`,
      params: orgEvent,
      requestBody: body(obj({ text: str({ minLength: 3, maxLength: 500 }) }, ['text'])),
      status: 201, response: ok('Submitted', { question: ref('Question') }), errors: [400, 403, 404, 429],
    }),
    get: op({
      tag: 'Q&A', summary: 'List questions, most upvoted first',
      description: `${PARTICIPANT} Moderators also see hidden questions and author names.`,
      params: [...orgEvent, query('limit', { type: 'integer', default: 50, maximum: 100 })],
      response: ok('Questions', { questions: arrayOf(ref('Question')) }), errors: [400, 403, 404],
    }),
  },
  '/organizations/{orgId}/events/{eventId}/questions/{questionId}/upvote': {
    post: op({
      tag: 'Q&A', summary: 'Upvote a question', description: `${PARTICIPANT} One upvote per user (second gets 409).`,
      params: [...orgEvent, param('questionId')],
      response: ok('Upvoted', { question: ref('Question') }), errors: [400, 403, 404, 409],
    }),
    delete: op({
      tag: 'Q&A', summary: 'Remove my upvote', description: PARTICIPANT,
      params: [...orgEvent, param('questionId')],
      response: ok('Removed', { question: ref('Question') }), errors: [403, 404],
    }),
  },
  '/organizations/{orgId}/events/{eventId}/questions/{questionId}/status': {
    patch: op({
      tag: 'Q&A', summary: 'Moderate a question', description: staffOr('manage_questions'),
      params: [...orgEvent, param('questionId')],
      requestBody: body(obj({ status: str({ enum: ['approved', 'hidden', 'answered'] }) }, ['status'])),
      response: ok('Updated', { question: ref('Question') }), errors: [403, 404],
    }),
  },

  // ===== Public discovery =====
  '/events': {
    get: op({
      tag: 'Public Events', summary: 'Browse upcoming public events', auth: false,
      params: [
        query('page', { type: 'integer', default: 1 }),
        query('limit', { type: 'integer', default: 12, maximum: 50 }),
        query('category', str({ enum: CATEGORIES })),
        query('eventType', str({ enum: EVENT_TYPES })),
        query('city', str()),
        query('search', str(), 'Matches event name.'),
        query('sort', str({ enum: ['upcoming', 'newest'], default: 'upcoming' })),
      ],
      response: ok('Events', { events: arrayOf(ref('PublicEvent')), pagination: ref('Pagination') }), errors: [400],
    }),
  },
  '/events/{orgSlug}/{eventSlug}': {
    get: op({
      tag: 'Public Events', summary: 'Event details by slug', auth: false,
      description: 'Public and unlisted events that are not draft or cancelled. The virtual join link is never included here; see /join-info.',
      params: orgSlugEventSlug, response: ok('Event', { event: ref('PublicEvent') }), errors: [404],
    }),
  },
  '/events/{orgSlug}/{eventSlug}/schedule': {
    get: op({
      tag: 'Public Events', summary: 'Event schedule with speakers', auth: false,
      params: orgSlugEventSlug,
      response: ok('Schedule', { event: ref('PublicEvent'), sessions: arrayOf(ref('Session')) }), errors: [404],
    }),
  },
  '/events/{orgSlug}/{eventSlug}/speakers': {
    get: op({
      tag: 'Public Events', summary: 'Speakers appearing at the event', auth: false,
      params: orgSlugEventSlug, response: ok('Speakers', { speakers: arrayOf(ref('Speaker')) }), errors: [404],
    }),
  },
  '/events/{orgSlug}/{eventSlug}/ticket-types': {
    get: op({
      tag: 'Public Events', summary: 'Tickets on sale, with live availability', auth: false,
      description: 'Active ticket types only. Use the returned ids with POST /registrations.',
      params: orgSlugEventSlug,
      response: ok('Ticket types', { ticketTypes: arrayOf(ref('PublicTicketType')) }), errors: [404],
    }),
  },
  '/events/{orgSlug}/{eventSlug}/join-info': {
    get: op({
      tag: 'Public Events', summary: 'How to join (virtual link) - registered attendees only',
      description: PARTICIPANT,
      params: orgSlugEventSlug,
      response: ok('Join info', { eventType: str({ enum: EVENT_TYPES }), virtualLink: nstr({ format: 'uri' }) }),
      errors: [403, 404],
    }),
  },

  // ===== Registrations =====
  '/registrations': {
    post: op({
      tag: 'Registrations', summary: 'Register for an event',
      description:
        'Inventory is decremented atomically inside a transaction, so tickets can never be oversold under concurrent requests. Free ticket types confirm immediately and return a ticket and QR code. Paid ticket types create a `pending_payment` registration; payment processing is not implemented yet.',
      requestBody: body(obj({ eventId: objectId, ticketTypeId: objectId }, ['eventId', 'ticketTypeId'])),
      status: 201,
      response: ok('Registered', {
        registration: ref('Registration'),
        ticket: { ...ref('Ticket'), nullable: true },
        qrCode: str({ description: 'PNG data URL. Null when no ticket was issued.' }),
        token: str({ description: 'Scan token (also embedded in the QR code).' }),
      }),
      errors: [400, 404, 409],
    }),
  },
  '/registrations/me': {
    get: op({
      tag: 'Registrations', summary: 'My registrations (event history)',
      response: ok('Registrations', { registrations: arrayOf(ref('Registration')) }),
    }),
  },
  '/registrations/{registrationId}/ticket': {
    get: op({
      tag: 'Registrations', summary: 'My ticket and QR code',
      params: [param('registrationId')],
      response: ok('Ticket', { ticket: ref('Ticket'), qrCode: str(), token: str() }), errors: [404],
    }),
  },
  '/registrations/{registrationId}/cancel': {
    post: op({
      tag: 'Registrations', summary: 'Cancel my registration (releases the inventory)',
      params: [param('registrationId')], response: ok('Cancelled'), errors: [400, 404],
    }),
  },

  // ===== Bookmarks =====
  '/bookmarks': {
    post: op({
      tag: 'Bookmarks', summary: 'Add a session to my agenda',
      requestBody: body(obj({ sessionId: objectId }, ['sessionId'])),
      status: 201, response: ok('Bookmarked'), errors: [400, 404, 409],
    }),
  },
  '/bookmarks/{sessionId}': {
    delete: op({
      tag: 'Bookmarks', summary: 'Remove a session from my agenda',
      params: [param('sessionId')], response: ok('Removed'), errors: [404],
    }),
  },
  '/bookmarks/event/{eventId}': {
    get: op({
      tag: 'Bookmarks', summary: 'My personal agenda for an event',
      params: [param('eventId')],
      response: ok('Agenda', { agenda: arrayOf(obj({ _id: objectId, session: ref('Session'), createdAt: dateTime })) }),
    }),
  },

  // ===== Notifications =====
  '/notifications': {
    get: op({
      tag: 'Notifications', summary: 'My notifications',
      params: [
        query('page', { type: 'integer', default: 1 }),
        query('limit', { type: 'integer', default: 20 }),
        query('unreadOnly', str({ enum: ['true'] }), 'Pass true to return only unread notifications; omit it for all.'),
      ],
      response: ok('Notifications', {
        notifications: arrayOf(ref('Notification')), unreadCount: { type: 'integer' }, pagination: ref('Pagination'),
      }),
    }),
  },
  '/notifications/{notificationId}/read': {
    patch: op({
      tag: 'Notifications', summary: 'Mark one notification as read',
      params: [param('notificationId')], response: ok('Updated', { notification: ref('Notification') }),
    }),
  },
  '/notifications/read-all': {
    patch: op({ tag: 'Notifications', summary: 'Mark all notifications as read', response: ok('Updated') }),
  },

  // ===== Uploads =====
  '/uploads/signature': {
    post: op({
      tag: 'Uploads', summary: 'Get a signed ticket to upload an image straight to Cloudinary',
      description:
        'Rate limited (30/hour). Needs the same permission as editing the target: any user for their own avatar; org owner/admin for a logo; owner/admin/manager for event banners and speaker photos. Then: (1) POST the returned `fields` plus the image as `file` (multipart form-data) to `uploadUrl`; (2) call /uploads/attach with the `publicId`. Formats: jpg, png, webp. Max 5 MB.',
      requestBody: body(obj({
        purpose: str({ enum: ['avatar', 'org_logo', 'event_banner', 'speaker_photo'] }),
        orgId: { ...objectId, description: 'Required for org_logo, event_banner, speaker_photo.' },
        eventId: { ...objectId, description: 'Required for event_banner.' },
        speakerId: { ...objectId, description: 'Required for speaker_photo.' },
      }, ['purpose'])),
      response: ok('Signed upload ticket', {
        uploadUrl: uri,
        fields: obj({
          timestamp: { type: 'integer' }, public_id: str(), allowed_formats: str(), api_key: str(), signature: str(),
        }),
        publicId: str(),
        maxBytes: { type: 'integer' },
      }),
      errors: [400, 403, 404, 429],
    }),
  },
  '/uploads/attach': {
    post: op({
      tag: 'Uploads', summary: 'Save an uploaded image to the avatar, logo, banner or speaker photo',
      description:
        'The server checks with Cloudinary that the image exists, is an allowed format and is within the size limit, and that it sits in the folder you are authorized for. The previous image is deleted.',
      requestBody: body(obj({
        purpose: str({ enum: ['avatar', 'org_logo', 'event_banner', 'speaker_photo'] }),
        orgId: objectId, eventId: objectId, speakerId: objectId,
        publicId: str({ description: 'The publicId returned by /uploads/signature.' }),
      }, ['purpose', 'publicId'])),
      response: ok('Saved', { image: obj({ url: uri, publicId: str() }) }),
      errors: [400, 403, 404, 429],
    }),
  },
};

const tagList = [
  ['Auth', 'Sign up, log in, token refresh, password reset'],
  ['Users', 'Profile, privacy and password'],
  ['Organizations', 'Tenants, members and invitations'],
  ['Speakers', 'Reusable speaker profiles'],
  ['Events', 'Event management and lifecycle'],
  ['Ticket Types', 'Ticket tiers and inventory'],
  ['Event Staff', 'Event-specific permissions'],
  ['Check-in', 'QR validation at the door'],
  ['Sessions', 'Event schedule'],
  ['Announcements', 'Live announcements'],
  ['Polls', 'Live polls'],
  ['Q&A', 'Audience questions and upvotes'],
  ['Public Events', 'Unauthenticated discovery (join-info needs login)'],
  ['Registrations', 'Registering and tickets'],
  ['Bookmarks', 'Personal agenda'],
  ['Notifications', 'In-app notifications'],
  ['Uploads', 'Direct-to-Cloudinary image uploads'],
].map(([name, description]) => ({ name, description }));

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'EventNest API',
    version: '1.0.0',
    description: [
      'Backend API for EventNest, a multi-tenant event management platform.',
      '',
      '**Authentication.** Log in with `POST /auth/login`, then click **Authorize** and paste the `accessToken` (15-minute lifetime). A rotating refresh token lives in an httpOnly cookie; call `POST /auth/refresh` (with header `X-Requested-With: XMLHttpRequest`) to get a new access token.',
      '',
      '**Response format.** Success: `{ "success": true, "message": "...", "data": { ... } }`. Errors: `{ "success": false, "message": "...", "details": [...] }`.',
      '',
      '**Tenant isolation.** Organization-scoped routes verify membership on the server for every request; the tenant is always taken from the URL and the caller\'s membership, never from the request body.',
      '',
      '**Real-time (Socket.IO).** Connect to the API origin with `auth: { token: <accessToken> }`, then emit `join:event` with an event id (acknowledgement `{ success }`). Events pushed to the room: `announcement:new`, `poll:opened`, `poll:updated`, `poll:closed`, `question:new`, `question:updated`.',
      '',
      '**Not implemented yet:** payments (paid tickets stay `pending_payment`) and scheduled emails such as event reminders.',
    ].join('\n'),
  },
  servers: [{ url: '/api/v1', description: 'This server' }],
  tags: [...tagList, ...analyticsDocs.tags],
  paths: { ...paths, ...analyticsDocs.paths },
  components: { ...components, schemas: { ...components.schemas, ...analyticsDocs.schemas } },
};