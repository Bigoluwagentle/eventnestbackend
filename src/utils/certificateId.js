const crypto = require('crypto');

// Crockford base32: no I, L, O or U, so an ID can be read aloud or typed without mix-ups.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PREFIX = 'ENC';
const GROUPS = 3;
const GROUP_LENGTH = 4;
const BODY_PATTERN = /^[0-9A-HJKMNP-TV-Z]{12}$/;

/** A public verification ID like ENC-7K3Q-9XMD-4P2R (60 bits of randomness). */
function generateCertificateId() {
  const bytes = crypto.randomBytes(GROUPS * GROUP_LENGTH);
  // 256 is a multiple of 32, so (byte % 32) is perfectly uniform: no modulo bias
  const chars = Array.from(bytes, (b) => ALPHABET[b % 32]);
  const groups = [];
  for (let i = 0; i < GROUPS; i += 1) {
    groups.push(chars.slice(i * GROUP_LENGTH, (i + 1) * GROUP_LENGTH).join(''));
  }
  return `${PREFIX}-${groups.join('-')}`;
}

/**
 * Turns what a person typed into the canonical ID, or null if it can't be one.
 * Accepts any case, spaces or missing dashes, and the usual look-alikes (O as 0, I or L as 1).
 */
function normalizeCertificateId(input) {
  if (typeof input !== 'string' || input.length > 40) return null;

  const compact = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (!compact.startsWith(PREFIX)) return null;

  const body = compact.slice(PREFIX.length);
  if (!BODY_PATTERN.test(body)) return null;

  const groups = body.match(/.{4}/g);
  return `${PREFIX}-${groups.join('-')}`;
}

module.exports = { generateCertificateId, normalizeCertificateId };