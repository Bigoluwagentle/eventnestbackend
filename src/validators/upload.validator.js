const { z } = require('zod');
const { objectId } = require('./common');

// Each purpose requires exactly the ids needed to authorize and locate its target.
// `extra` lets the attach schema add publicId without repeating the variants.
function targetUnion(extra = {}) {
  return z.discriminatedUnion('purpose', [
    z.object({ purpose: z.literal('avatar'), ...extra }),
    z.object({ purpose: z.literal('org_logo'), orgId: objectId(), ...extra }),
    z.object({ purpose: z.literal('event_banner'), orgId: objectId(), eventId: objectId(), ...extra }),
    z.object({ purpose: z.literal('speaker_photo'), orgId: objectId(), speakerId: objectId(), ...extra }),
  ]);
}

const signatureSchema = z.object({ body: targetUnion() });

const attachSchema = z.object({
  body: targetUnion({ publicId: z.string().trim().min(1).max(300) }),
});

module.exports = { signatureSchema, attachSchema };