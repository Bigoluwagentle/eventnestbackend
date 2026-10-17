// OpenAPI entries for the post-event gallery. Merged into the main spec via extensions.js.

const str = (extra = {}) => ({ type: 'string', ...extra });
const int = (extra = {}) => ({ type: 'integer', ...extra });
const obj = (properties) => ({ type: 'object', properties });
const arrayOf = (items) => ({ type: 'array', items });
const dateTime = str({ format: 'date-time' });
const uri = str({ format: 'uri' });
const objectId = str({ example: '6a8d4376d3adacdfed9a7313' });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const envelope = (data) => obj({ success: { type: 'boolean', example: true }, message: str(), ...(data ? { data: obj(data) } : {}) });
const ok = (description, data) => ({ description, content: json(envelope(data)) });
const response = (name) => ({ $ref: `#/components/responses/${name}` });
const body = (schema) => ({ required: true, content: json(schema) });

const MANAGE = 'Requires org role: owner, admin or manager.';
const orgEvent = [{ $ref: '#/components/parameters/orgId' }, { $ref: '#/components/parameters/eventId' }];
const itemIdParam = { name: 'itemId', in: 'path', required: true, schema: objectId, description: 'Gallery item id' };
const ACCESS = ['private', 'attendees', 'public'];
const orgErrors = { 400: response('BadRequest'), 401: response('Unauthorized'), 403: response('Forbidden'), 404: response('NotFound') };

const pagination = ref('Pagination');
const counts = obj({ photo: int(), video: int(), resource: int() });

const schemas = {
  GalleryItem: obj({
    _id: objectId,
    type: str({ enum: ['photo', 'video', 'resource'] }),
    title: str(),
    caption: str(),
    createdAt: dateTime,
    photo: {
      ...obj({
        url: { ...uri, description: 'Optimized for display (max 2000px wide).' },
        thumbnailUrl: uri,
        downloadUrl: { ...uri, description: 'Original quality, saved as a file.' },
        width: int(),
        height: int(),
      }),
      description: 'Only for photos.',
    },
    video: {
      ...obj({
        provider: str({ enum: ['youtube', 'vimeo'] }),
        videoId: str(),
        watchUrl: uri,
        embedUrl: { ...uri, description: 'Safe to use as an iframe source. Built by the server from the id.' },
      }),
      description: 'Only for videos.',
    },
    resource: { ...obj({ url: uri }), description: 'Only for resources. Always an https link: open it with rel="noopener noreferrer".' },
  }),
};

const paths = {
  '/organizations/{orgId}/events/{eventId}/gallery': {
    get: {
      tags: ['Gallery'],
      summary: "Browse the event gallery (organizer view, always visible)",
      description: `${MANAGE} Items are listed oldest first so pages stay stable while uploads continue. \`counts\` always covers every type.`,
      security: [{ bearerAuth: [] }],
      parameters: [
        ...orgEvent,
        { name: 'page', in: 'query', schema: int({ default: 1, minimum: 1 }) },
        { name: 'limit', in: 'query', schema: int({ default: 24, minimum: 1, maximum: 100 }) },
        { name: 'type', in: 'query', schema: str({ enum: ['photo', 'video', 'resource'] }) },
      ],
      responses: {
        200: ok('Gallery', { access: str({ enum: ACCESS }), items: arrayOf(ref('GalleryItem')), counts, pagination }),
        ...orgErrors,
      },
    },
  },
  '/organizations/{orgId}/events/{eventId}/gallery/settings': {
    patch: {
      tags: ['Gallery'],
      summary: 'Choose who can see the gallery',
      description:
        `${MANAGE} \`private\` (default): organization members only. \`attendees\`: confirmed attendees, event staff and organization members. \`public\`: anyone who can see the event page. ` +
        'Access is enforced by this API; photos themselves live at unguessable but public image URLs, so do not upload anything that must stay secret.',
      security: [{ bearerAuth: [] }],
      parameters: orgEvent,
      requestBody: body(obj({ access: str({ enum: ACCESS }) })),
      responses: { 200: ok('Updated', { access: str({ enum: ACCESS }) }), ...orgErrors },
    },
  },
  '/organizations/{orgId}/events/{eventId}/gallery/photos/signatures': {
    post: {
      tags: ['Gallery'],
      summary: 'Step 1 of adding photos: get signed upload tickets',
      description:
        `${MANAGE} Rate limited (60 per hour). Ask for one ticket per photo (up to 20). Then, for each photo, POST its ticket's \`fields\` plus the image as \`file\` (multipart form-data) straight to the ticket's \`uploadUrl\` (jpg, png or webp, max 5 MB), and finally call POST /gallery/photos with the \`publicId\`s.`,
      security: [{ bearerAuth: [] }],
      parameters: orgEvent,
      requestBody: { required: false, content: json(obj({ count: int({ minimum: 1, maximum: 20, default: 1 }) })) },
      responses: {
        200: ok('Tickets', {
          tickets: arrayOf(obj({
            uploadUrl: uri,
            fields: obj({ timestamp: int(), public_id: str(), allowed_formats: str(), api_key: str(), signature: str() }),
            publicId: str(),
            maxBytes: int(),
          })),
        }),
        ...orgErrors,
      },
    },
  },
  '/organizations/{orgId}/events/{eventId}/gallery/photos': {
    post: {
      tags: ['Gallery'],
      summary: 'Step 2 of adding photos: save the uploaded photos to the gallery',
      description:
        `${MANAGE} Rate limited. The server asks the image host about the whole batch in one call and checks each photo exists, is an allowed format, is within 5 MB and sits in this event's own folder. ` +
        'Any problem rejects the whole batch. Sending the same photo again is harmless. A gallery holds at most 500 items. Responds 201 when something new was added, otherwise 200.',
      security: [{ bearerAuth: [] }],
      parameters: orgEvent,
      requestBody: body(obj({
        photos: { type: 'array', minItems: 1, maxItems: 20, items: obj({ publicId: str(), caption: str({ maxLength: 500 }) }) },
      })),
      responses: {
        200: ok('Nothing new to add', { added: int(), items: arrayOf(ref('GalleryItem')) }),
        201: ok('Photos added', { added: int(), items: arrayOf(ref('GalleryItem')) }),
        ...orgErrors,
      },
    },
  },
  '/organizations/{orgId}/events/{eventId}/gallery/videos': {
    post: {
      tags: ['Gallery'],
      summary: 'Add a YouTube or Vimeo video',
      description:
        `${MANAGE} Only YouTube and Vimeo links are accepted (watch, short, embed and unlisted-Vimeo forms). The link itself is not stored: only the provider and video id, from which safe watch and embed URLs are rebuilt.`,
      security: [{ bearerAuth: [] }],
      parameters: orgEvent,
      requestBody: body({ ...obj({ url: str(), title: str({ maxLength: 150 }), caption: str({ maxLength: 500 }) }), required: ['url'] }),
      responses: { 201: ok('Video added', { item: ref('GalleryItem') }), ...orgErrors },
    },
  },
  '/organizations/{orgId}/events/{eventId}/gallery/resources': {
    post: {
      tags: ['Gallery'],
      summary: 'Add a link to slides, a document or a folder',
      description: `${MANAGE} Resources are https links (Google Drive, Dropbox, SlideShare...), not hosted files. http, javascript:, data: and links with embedded credentials are rejected.`,
      security: [{ bearerAuth: [] }],
      parameters: orgEvent,
      requestBody: body({ ...obj({ title: str({ maxLength: 150 }), url: uri, description: str({ maxLength: 500 }) }), required: ['title', 'url'] }),
      responses: { 201: ok('Resource added', { item: ref('GalleryItem') }), ...orgErrors },
    },
  },
  '/organizations/{orgId}/events/{eventId}/gallery/items/{itemId}': {
    patch: {
      tags: ['Gallery'],
      summary: 'Edit a title or caption',
      description: `${MANAGE} A resource cannot be left without a title.`,
      security: [{ bearerAuth: [] }],
      parameters: [...orgEvent, itemIdParam],
      requestBody: body(obj({ title: str({ maxLength: 150 }), caption: str({ maxLength: 500 }) })),
      responses: { 200: ok('Updated', { item: ref('GalleryItem') }), ...orgErrors },
    },
    delete: {
      tags: ['Gallery'],
      summary: 'Remove an item (a photo is also deleted from the image host)',
      description: MANAGE,
      security: [{ bearerAuth: [] }],
      parameters: [...orgEvent, itemIdParam],
      responses: { 200: ok('Deleted'), ...orgErrors },
    },
  },
  '/events/{orgSlug}/{eventSlug}/gallery': {
    get: {
      tags: ['Gallery'],
      summary: 'View an event gallery (attendees and the public)',
      description:
        'Login is optional: send the Authorization header when you have a token. Who may see the gallery is the organizer\'s choice. `public` galleries need no login. `attendees` galleries need a login of a confirmed attendee, event staff or organization member (401 if not logged in, 403 if logged in but not allowed). `private` galleries are for organization members only. Always responds with `Cache-Control: private, no-store` because the answer depends on who asks.',
      security: [{}, { bearerAuth: [] }],
      parameters: [
        { name: 'orgSlug', in: 'path', required: true, schema: str(), description: 'Organization slug' },
        { name: 'eventSlug', in: 'path', required: true, schema: str(), description: 'Event slug' },
        { name: 'page', in: 'query', schema: int({ default: 1, minimum: 1 }) },
        { name: 'limit', in: 'query', schema: int({ default: 24, minimum: 1, maximum: 60 }) },
        { name: 'type', in: 'query', schema: str({ enum: ['photo', 'video', 'resource'] }) },
      ],
      responses: {
        200: ok('Gallery', { access: str({ enum: ACCESS }), items: arrayOf(ref('GalleryItem')), counts, pagination }),
        400: response('BadRequest'), 401: response('Unauthorized'), 403: response('Forbidden'), 404: response('NotFound'),
      },
    },
  },
};

const tags = [{ name: 'Gallery', description: 'Post-event photos, videos and resources' }];

module.exports = { schemas, paths, tags };