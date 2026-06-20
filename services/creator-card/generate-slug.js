const { randomInt } = require('crypto');

const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789';

// Slug field constraint (assessment §4): 5-50 chars. Auto-generated slugs bypass the
// VSL `maxLength:50` check (which only runs for client-provided slugs), so the cap is
// enforced here to keep generated slugs within the documented bound.
const MAX_SLUG_LENGTH = 50;
const SUFFIX_LENGTH = 6;

/**
 * Derive the base slug from a title:
 * lowercase -> whitespace to hyphens -> strip everything outside [a-z0-9_-].
 * @param {String} title
 * @returns {String}
 */
function baseSlug(title) {
  return String(title)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');
}

/**
 * Truncate a slug candidate to at most `max` chars without leaving a trailing separator.
 * @param {String} slug
 * @param {Number} max
 * @returns {String}
 */
function clampSlug(slug, max) {
  if (slug.length <= max) {
    return slug;
  }
  return slug.slice(0, max).replace(/[-_]+$/, '');
}

/**
 * Generate a random alphanumeric suffix (e.g. "a8x2k1").
 * @returns {String}
 */
function randomSuffix() {
  let suffix = '';
  for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
    suffix += ALPHANUMERIC[randomInt(ALPHANUMERIC.length)];
  }
  return suffix;
}

/**
 * Resolve a unique slug from a title per the assessment rules:
 *   1. Build the base slug from the title (capped to the 50-char slug limit).
 *   2. If the base is shorter than 5 chars OR already taken (live), append
 *      "-" + a 6-char random alphanumeric suffix, retrying until unique.
 *
 * The base is capped so that both the plain slug and the suffixed slug stay
 * within the documented 5-50 character bound.
 *
 * @param {Object} repo - The CreatorCard repository (used for live uniqueness checks).
 * @param {String} title
 * @returns {Promise<String>} A unique slug, 5-50 chars.
 */
async function generateSlug(repo, title) {
  const fullBase = baseSlug(title);
  // Base for the plain slug, capped to the 50-char limit.
  const base = clampSlug(fullBase, MAX_SLUG_LENGTH);
  // Base for the suffixed slug, leaving room for "-" + the suffix (stays <= 50).
  const suffixBase = clampSlug(fullBase, MAX_SLUG_LENGTH - SUFFIX_LENGTH - 1);

  let slug = base;
  let needsSuffix = slug.length < 5;
  if (!needsSuffix) {
    needsSuffix = Boolean(await repo.findOne({ query: { slug } }));
  }

  while (needsSuffix) {
    slug = suffixBase ? `${suffixBase}-${randomSuffix()}` : randomSuffix();
    // eslint-disable-next-line no-await-in-loop
    needsSuffix = Boolean(await repo.findOne({ query: { slug } }));
  }

  return slug;
}

module.exports = generateSlug;
