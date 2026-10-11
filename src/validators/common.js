const { z } = require('zod');

function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// z.string().url() also accepts schemes like javascript: - never safe to render as a link
const httpUrl = () => z.string().trim().max(300).refine(isHttpUrl, 'Must be a valid http(s) URL');

const objectId = () => z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const strongPassword = () =>
  z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters') // bcrypt ignores everything past 72 bytes
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number');

module.exports = { httpUrl, objectId, strongPassword };