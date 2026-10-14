// OpenAPI entries for the analytics endpoints. Merged into the main spec by openapi.js.

const str = (extra = {}) => ({ type: 'string', ...extra });
const int = (extra = {}) => ({ type: 'integer', ...extra });
const obj = (properties) => ({ type: 'object', properties });
const arrayOf = (items) => ({ type: 'array', items });
const dateTime = str({ format: 'date-time' });
const objectId = str({ example: '6a8d4376d3adacdfed9a7313' });
const fraction = { type: 'number', description: 'A fraction between 0 and 1 (0.5 means 50%).' };
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const day = (field) => obj({ date: str({ example: '2026-10-02' }), [field]: int() });
const byStatus = { type: 'object', additionalProperties: int() };
const revenue = arrayOf(obj({ currency: str({ example: 'USD' }), amount: { type: 'number' } }));
const registrations = obj({ total: int({ description: 'Excludes cancelled.' }), confirmed: int(), pendingPayment: int(), waitlisted: int(), cancelled: int() });

const schemas = {
  EventAnalytics: obj({
    event: obj({ _id: objectId, name: str(), status: str(), startDate: dateTime, endDate: dateTime, timezone: str() }),
    registrations: {
      ...registrations,
      properties: { ...registrations.properties, uniqueAttendees: int({ description: 'Distinct people with a confirmed registration.' }) },
    },
    tickets: obj({
      inventory: int({ description: 'Total tickets across all ticket types.' }),
      sold: int({ description: 'Includes unpaid reservations (pending_payment).' }),
      remaining: int(),
      fillRate: fraction,
      issued: int({ description: 'Tickets that exist and are still usable or used (not cancelled).' }),
    }),
    checkIn: obj({
      checkedIn: int(), ticketsIssued: int(), notCheckedIn: int(),
      rate: { ...fraction, description: 'Checked in / tickets issued. This is also the attendance rate.' },
    }),
    revenue: { ...revenue, description: 'Confirmed registrations only, per currency. 0 until payments exist.' },
    ticketTypes: arrayOf(obj({
      _id: objectId, name: str(), price: { type: 'number' }, currency: str(), isActive: { type: 'boolean' },
      quantity: int(), sold: int(), remaining: int(), fillRate: fraction, ticketsIssued: int(), checkedIn: int(), revenue: { type: 'number' },
    })),
    registrationsByDay: { ...arrayOf(day('registrations')), description: "Grouped in the event's time zone, cancelled excluded. Days without registrations are omitted." },
    sessions: obj({
      total: int(), totalBookmarks: int(),
      popular: arrayOf(obj({ _id: objectId, title: str(), type: str(), startTime: dateTime, bookmarks: int() })),
    }),
    polls: obj({
      total: int(), totalVotes: int(), averageParticipationRate: fraction,
      items: arrayOf(obj({
        _id: objectId, question: str(), status: str(), isAnonymous: { type: 'boolean' }, totalVotes: int(), participationRate: fraction,
        options: arrayOf(obj({ _id: objectId, text: str(), voteCount: int() })),
      })),
    }),
    questions: obj({ total: int(), totalUpvotes: int(), byStatus: obj({ approved: int(), answered: int(), hidden: int() }) }),
    engagement: obj({
      engagedAttendees: int({ description: 'Confirmed attendees who voted, asked, upvoted or bookmarked.' }),
      engagementRate: fraction,
    }),
  }),
  OrganizationAnalytics: obj({
    events: obj({ total: int(), upcomingPublished: int(), byStatus }),
    registrations,
    checkIn: obj({ checkedIn: int(), ticketsIssued: int(), rate: fraction }),
    revenue,
    topEvents: arrayOf(obj({ _id: objectId, name: str(), slug: str(), status: str(), startDate: dateTime, registrations: int() })),
    registrationsLast30Days: arrayOf(day('registrations')),
  }),
  PlatformAnalytics: obj({
    totals: obj({
      users: int(), activeUsers: int(), verifiedUsers: int(), organizations: int(), suspendedOrganizations: int(), events: int(),
      upcomingPublishedEvents: int(), registrations: int({ description: 'Excludes cancelled.' }), ticketsIssued: int(), checkIns: int(),
    }),
    eventsByStatus: byStatus,
    registrationsByStatus: byStatus,
    newInLast7Days: obj({ users: int(), organizations: int(), events: int(), registrations: int() }),
    newInLast30Days: obj({ users: int(), organizations: int(), events: int(), registrations: int() }),
    growth: obj({ usersByDay: arrayOf(day('users')), registrationsByDay: arrayOf(day('registrations')) }),
  }),
};

const report = (tag, summary, description, schema, params, errors) => ({
  get: {
    tags: [tag],
    summary,
    description,
    security: [{ bearerAuth: [] }],
    ...(params ? { parameters: params } : {}),
    responses: {
      200: {
        description: summary,
        content: { 'application/json': { schema: obj({ success: { type: 'boolean', example: true }, data: obj({ analytics: ref(schema) }) }) } },
      },
      ...Object.fromEntries(errors.map((c) => [String(c), { $ref: `#/components/responses/${{ 401: 'Unauthorized', 403: 'Forbidden', 404: 'NotFound' }[c]}` }])),
    },
  },
});

const paths = {
  '/organizations/{orgId}/events/{eventId}/analytics': report(
    'Analytics',
    'Analytics for one event',
    'Requires org role owner/admin/manager, or event staff with the "view_analytics" permission. Aggregate numbers only: no individual attendee is identified, and anonymous polls stay anonymous. All rates are fractions between 0 and 1.',
    'EventAnalytics',
    [{ $ref: '#/components/parameters/orgId' }, { $ref: '#/components/parameters/eventId' }],
    [401, 403, 404]
  ),
  '/organizations/{orgId}/analytics': report(
    'Analytics',
    "Overview of an organization's events",
    'Requires org role: owner, admin or manager. Covers every event of this organization and nothing from other organizations.',
    'OrganizationAnalytics',
    [{ $ref: '#/components/parameters/orgId' }],
    [401, 403, 404]
  ),
  '/admin/analytics': report(
    'Admin',
    'Platform-wide totals and growth',
    'Super admins only. Counts only: no names, emails or per-organization data. Promote an account with `node scripts/make-super-admin.js <email>`.',
    'PlatformAnalytics',
    undefined,
    [401, 403]
  ),
};

const tags = [
  { name: 'Analytics', description: 'Reports for organizers' },
  { name: 'Admin', description: 'Platform administration (super admins)' },
];

module.exports = { schemas, paths, tags };