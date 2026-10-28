const { z } = require('zod');
const { objectId } = require('./common');

const createReportSchema = z.object({
  body: z.object({
    targetType: z.enum(['event', 'organization', 'user']),
    targetId: objectId(),
    reason: z.enum(['spam', 'scam', 'inappropriate', 'harassment', 'copyright', 'other']),
    details: z.string().trim().max(1000).optional(),
  }),
});

module.exports = { createReportSchema };