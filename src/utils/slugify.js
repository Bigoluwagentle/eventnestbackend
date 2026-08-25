const { customAlphabet } = require('nanoid');

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Generates a base slug from text, checking uniqueness via the provided
 * existence-check function. Appends a short random suffix on collision.
 * @param {string} text
 * @param {(slug: string) => Promise<boolean>} existsFn - returns true if slug is taken
 */
async function generateUniqueSlug(text, existsFn) {
  const base = slugify(text) || 'org';
  let slug = base;
  let attempts = 0;

  // eslint-disable-next-line no-await-in-loop
  while (await existsFn(slug)) {
    attempts += 1;
    slug = `${base}-${nanoid()}`;
    if (attempts > 5) break; // safety valve, extremely unlikely to hit
  }

  return slug;
}

module.exports = { slugify, generateUniqueSlug };