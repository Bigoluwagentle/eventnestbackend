// OpenAPI entry for the organizer's view of a ticket type's waiting list.
// (The waiting-list changes to the registration and ticket endpoints are small edits to openapi.js itself.)

const str = (extra = {}) => ({ type: 'string', ...extra });
const int = (extra = {}) => ({ type: 'integer', ...extra });
const obj = (properties) => ({ type: 'object', properties });
const arrayOf = (items) => ({ type: 'array', items });
const objectId = str({ example: '6a8d4376d3adacdfed9a7313' });
const response = (name) => ({ $ref: `#/components/responses/${name}` });
const json = (schema) => ({ 'application/json': { schema } });

const paths = {
  '/organizations/{orgId}/events/{eventId}/ticket-types/{ticketTypeId}/waitlist': {
    get: {
      tags: ['Ticket Types'],
      summary: 'Who is waiting for this ticket type',
      description:
        'Requires org role: owner, admin or manager. Oldest first, which is the order people are promoted in. Shows names and when they joined, never emails or ids, so the list shows demand without exposing anyone. Only free ticket types have a waiting list.',
      security: [{ bearerAuth: [] }],
      parameters: [
        { $ref: '#/components/parameters/orgId' },
        { $ref: '#/components/parameters/eventId' },
        { name: 'ticketTypeId', in: 'path', required: true, schema: objectId, description: 'Ticket type id' },
        { name: 'page', in: 'query', schema: int({ default: 1, minimum: 1 }) },
        { name: 'limit', in: 'query', schema: int({ default: 50, minimum: 1, maximum: 100 }) },
      ],
      responses: {
        200: {
          description: 'Waiting list',
          content: json(obj({
            success: { type: 'boolean', example: true },
            data: obj({
              total: int(),
              entries: arrayOf(obj({ position: int({ description: '1 = next in line' }), name: { type: 'string', nullable: true }, joinedAt: str({ format: 'date-time' }) })),
              pagination: { $ref: '#/components/schemas/Pagination' },
            }),
          })),
        },
        400: response('BadRequest'), 401: response('Unauthorized'), 403: response('Forbidden'), 404: response('NotFound'),
      },
    },
  },
};

module.exports = { schemas: {}, paths, tags: [] };