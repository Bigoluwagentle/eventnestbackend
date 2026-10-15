const { z } = require('zod');
const { objectId } = require('./common');

const orgEvent = { orgId: objectId(), eventId: objectId() };

const generateCertificatesSchema = z.object({
  params: z.object(orgEvent),
  body: z.object({
    eligibility: z.enum(['checked_in', 'all_registered']).default('checked_in'),
  }),
});

const listCertificatesSchema = z.object({
  params: z.object(orgEvent),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['valid', 'revoked']).optional(),
  }),
});

const revokeCertificateSchema = z.object({
  params: z.object({ ...orgEvent, certId: objectId() }),
  body: z.object({
    reason: z.string().trim().max(300).optional(),
  }),
});

// The public ID is normalized and checked by the service; this only bounds its size.
const certificateIdParamSchema = z.object({
  params: z.object({ certificateId: z.string().trim().min(1).max(40) }),
});

module.exports = {
  generateCertificatesSchema,
  listCertificatesSchema,
  revokeCertificateSchema,
  certificateIdParamSchema,
};