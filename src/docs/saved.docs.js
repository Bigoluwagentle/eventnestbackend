// OpenAPI entries for saved events (the heart on a discovery card).

const str = (extra = {}) => ({ type: 'string', ...extra });
const int = (extra = {}) => ({ type: 'integer', ...extra });
const obj = (properties) => ({ type: 'object', properties });
const arrayOf = (items) => ({ type: 'array', items });
const dateTime = str({ format: 'date-time' });
const objectId = str({ example: '6a8d4376d3adacdfed9a7313' });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const envelope = (data) => obj({ success: { type: 'boolean', example: true }, message: str(), ...(data ? { data: obj(data) } : {}) });
const ok = (description, data) => ({ description, content: json(envelope(data)) });
const response = (name) => ({ $ref: `#/components/responses/${name}` });
const security = [{ bearerAuth: [] }];
const eventIdParam = { name: 'eventId', in: 'path', required: true, schema: objectId, description: 'Event id' };

const schemas = {
  SavedEventCard: obj({
    _id: objectId, name: str(), slug: str(), shortDescription: str(), category: str(), eventType: str({ enum: ['physical', 'virtual', 'hybrid'] }),
    startDate: dateTime, endDate: dateTime, timezone: str(), city: { type: 'string', nullable: true }, country: { type: 'string', nullable: true },
    banner: obj({ url: { type: 'string', nullable: true } }), status: str(),
    organization: obj({ name: str(), slug: str(), logo: obj({ url: { type: 'string', nullable: true } }) }),
    savedAt: dateTime, isPast: { type: 'boolean' },
  }),
};

const paths = {
  '/saved-events': {
    get: {
      tags: ['Saved Events'], summary: 'My saved events', security,
      description:
        'Newest saves first. An event that is no longer visible (it became a draft, private or cancelled, or its organization was suspended) quietly drops out of the list; the save is kept and the event returns if it becomes visible again. Past events are included and flagged with `isPast`.',
      parameters: [
        { name: 'page', in: 'query', schema: int({ default: 1, minimum: 1 }) },
        { name: 'limit', in: 'query', schema: int({ default: 20, minimum: 1, maximum: 50 }) },
        { name: 'upcoming', in: 'query', schema: str({ enum: ['true', 'false'], default: 'false' }), description: 'true leaves out events that have already ended.' },
      ],
      responses: { 200: ok('Saved events', { events: arrayOf(ref('SavedEventCard')), pagination: ref('Pagination') }), 400: response('BadRequest'), 401: response('Unauthorized') },
    },
  },
  '/saved-events/status': {
    get: {
      tags: ['Saved Events'], summary: 'Which of these events have I saved?', security,
      description: 'Pass up to 50 event ids, comma separated, and get back the ones you have saved. One request fills the hearts for a whole page of cards.',
      parameters: [{ name: 'eventIds', in: 'query', required: true, schema: str({ maxLength: 2000, example: '6a8d4376d3adacdfed9a7313,6a8d499c346ce714a05af783' }) }],
      responses: { 200: ok('Saved ids', { saved: arrayOf(objectId) }), 400: response('BadRequest'), 401: response('Unauthorized') },
    },
  },
  '/saved-events/{eventId}': {
    put: {
      tags: ['Saved Events'], summary: 'Save an event', security,
      description: 'Idempotent: saving something already saved is fine. Only events anyone could find publicly can be saved (public or unlisted, not a draft or cancelled, from an active organization); anything else answers 404. Limit: 500 saved events per person.',
      parameters: [eventIdParam],
      responses: { 200: ok('Saved', { saved: { type: 'boolean', example: true } }), 400: response('BadRequest'), 401: response('Unauthorized'), 404: response('NotFound') },
    },
    delete: {
      tags: ['Saved Events'], summary: 'Remove a saved event', security,
      description: 'Idempotent, and answers the same whether or not the event was saved.',
      parameters: [eventIdParam],
      responses: { 200: ok('Removed', { saved: { type: 'boolean', example: false } }), 400: response('BadRequest'), 401: response('Unauthorized') },
    },
  },
};

const tags = [{ name: 'Saved Events', description: 'The heart on an event card' }];

module.exports = { schemas, paths, tags };