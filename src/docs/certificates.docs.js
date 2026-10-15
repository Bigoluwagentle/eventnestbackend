// OpenAPI entries for the certificate endpoints. Merged into the main spec via extensions.js.

const str = (extra = {}) => ({ type: 'string', ...extra });
const int = (extra = {}) => ({ type: 'integer', ...extra });
const obj = (properties) => ({ type: 'object', properties });
const arrayOf = (items) => ({ type: 'array', items });
const dateTime = str({ format: 'date-time' });
const objectId = str({ example: '6a8d4376d3adacdfed9a7313' });
const certificateIdExample = 'ENC-7K3Q-9XMD-4P2R';
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const envelope = (data) => obj({ success: { type: 'boolean', example: true }, message: str(), ...(data ? { data: obj(data) } : {}) });
const ok = (description, data) => ({ description, content: json(envelope(data)) });
const response = (name) => ({ $ref: `#/components/responses/${name}` });
const error = (description) => ({ description, content: json(ref('Error')) });

const orgEvent = [{ $ref: '#/components/parameters/orgId' }, { $ref: '#/components/parameters/eventId' }];
const certificateIdParam = {
  name: 'certificateId', in: 'path', required: true, schema: str({ example: certificateIdExample }),
  description: 'The public certificate ID. Case, spaces and dashes are forgiven when typing it.',
};
const MANAGE = 'Requires org role: owner, admin or manager.';

const schemas = {
  CertificateSummary: obj({
    _id: objectId, certificateId: str({ example: certificateIdExample }), eventName: str(), organizationName: str(),
    eventStartDate: dateTime, eventEndDate: dateTime, timezone: str(), issuedAt: dateTime, status: str({ enum: ['valid', 'revoked'] }),
  }),
  CertificateVerification: obj({
    valid: { type: 'boolean' },
    status: str({ enum: ['valid', 'revoked'] }),
    certificate: obj({
      certificateId: str(),
      recipientName: str({ description: 'Only for valid certificates.' }),
      eventName: str(),
      eventStartDate: { ...dateTime, description: 'Only for valid certificates.' },
      eventEndDate: { ...dateTime, description: 'Only for valid certificates.' },
      timezone: str({ description: 'Only for valid certificates.' }),
      organizationName: str(),
      issuedAt: dateTime,
      revokedAt: { ...dateTime, description: 'Only for revoked certificates.' },
    }),
  }),
};

const paths = {
  '/organizations/{orgId}/events/{eventId}/certificates/generate': {
    post: {
      tags: ['Certificates'],
      summary: 'Issue certificates to attendees',
      description:
        `${MANAGE} The event must be completed. Safe to run again: attendees who already hold a valid certificate are skipped, so late check-ins are picked up. Newly certified attendees get an in-app notification. ` +
        '`checked_in` (default) certifies people whose ticket was scanned; `all_registered` certifies everyone with a confirmed registration (useful for virtual events with no scanning).',
      security: [{ bearerAuth: [] }],
      parameters: orgEvent,
      requestBody: {
        required: false,
        content: json(obj({ eligibility: str({ enum: ['checked_in', 'all_registered'], default: 'checked_in' }) })),
      },
      responses: {
        200: ok('Certificates issued', { eligible: int(), issued: int(), alreadyIssued: int() }),
        400: response('BadRequest'), 401: response('Unauthorized'), 403: response('Forbidden'), 404: response('NotFound'),
      },
    },
  },
  '/organizations/{orgId}/events/{eventId}/certificates': {
    get: {
      tags: ['Certificates'],
      summary: "List an event's certificates",
      description: MANAGE,
      security: [{ bearerAuth: [] }],
      parameters: [
        ...orgEvent,
        { name: 'page', in: 'query', schema: int({ default: 1, minimum: 1 }) },
        { name: 'limit', in: 'query', schema: int({ default: 20, minimum: 1, maximum: 100 }) },
        { name: 'status', in: 'query', schema: str({ enum: ['valid', 'revoked'] }) },
      ],
      responses: {
        200: ok('Certificates', {
          certificates: arrayOf(obj({
            _id: objectId, certificateId: str(), user: objectId, recipientName: str(), status: str({ enum: ['valid', 'revoked'] }),
            issuedAt: dateTime, revokedAt: { ...dateTime, nullable: true }, revokedReason: { type: 'string', nullable: true },
          })),
          pagination: ref('Pagination'),
        }),
        400: response('BadRequest'), 401: response('Unauthorized'), 403: response('Forbidden'), 404: response('NotFound'),
      },
    },
  },
  '/organizations/{orgId}/events/{eventId}/certificates/{certId}/revoke': {
    post: {
      tags: ['Certificates'],
      summary: 'Revoke a certificate',
      description:
        'Requires org role: owner or admin. A revoked certificate verifies as revoked and can no longer be downloaded. The attendee can later be issued a fresh certificate by running generate again.',
      security: [{ bearerAuth: [] }],
      parameters: [...orgEvent, { name: 'certId', in: 'path', required: true, schema: objectId, description: 'The certificate record id (the `_id`, not the public certificateId).' }],
      requestBody: { required: false, content: json(obj({ reason: str({ maxLength: 300 }) })) },
      responses: {
        200: ok('Revoked', { certificate: obj({ _id: objectId, certificateId: str(), status: str(), revokedAt: dateTime }) }),
        400: response('BadRequest'), 401: response('Unauthorized'), 403: response('Forbidden'), 404: response('NotFound'), 409: response('Conflict'),
      },
    },
  },
  '/certificates/me': {
    get: {
      tags: ['Certificates'],
      summary: 'My certificates',
      security: [{ bearerAuth: [] }],
      responses: {
        200: ok('My certificates', { certificates: arrayOf(ref('CertificateSummary')) }),
        401: response('Unauthorized'),
      },
    },
  },
  '/certificates/me/{certificateId}/pdf': {
    get: {
      tags: ['Certificates'],
      summary: 'Download my certificate as a PDF',
      description:
        'Owner only. The PDF is rendered on demand from the stored record, with a QR code that links to the verification page. Because it needs the login token, fetch it with an Authorization header and save the response as a file. Supported name scripts: Latin (including Yoruba and Vietnamese letters), Greek and Cyrillic.',
      security: [{ bearerAuth: [] }],
      parameters: [certificateIdParam],
      responses: {
        200: { description: 'The certificate PDF', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
        401: response('Unauthorized'),
        404: response('NotFound'),
        410: error('The certificate has been revoked.'),
        422: error('The name contains characters the PDF font cannot display yet. The certificate is still valid and can be verified online.'),
      },
    },
  },
  '/certificates/verify/{certificateId}': {
    get: {
      tags: ['Certificates'],
      summary: 'Verify a certificate by its public ID',
      description:
        'Public, no login. Rate limited (30 per 15 minutes per IP). Returns only what a verifier needs: never an email or user id, and a revoked certificate shows no recipient name. Malformed and unknown IDs get the same 404.',
      parameters: [certificateIdParam],
      responses: {
        200: ok('Verification result', schemas.CertificateVerification.properties),
        404: response('NotFound'),
        429: response('TooManyRequests'),
      },
    },
  },
};

const tags = [{ name: 'Certificates', description: 'Certificates of attendance with public verification' }];

module.exports = { schemas, paths, tags };