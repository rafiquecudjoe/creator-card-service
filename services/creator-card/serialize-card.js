/**
 * Serialize a Creator Card DB record into the public API response shape.
 *
 * - Maps `_id` -> `id`; `_id` is never exposed.
 * - Maps the paranoid `deleted: 0` sentinel back to `null` for live cards.
 * - `access_code` is included only when `includeAccessCode` is true (POST & DELETE);
 *   it is omitted entirely from GET responses.
 *
 * @param {Object} card - Lean DB record (has `_id`, not `id`).
 * @param {Object} [options]
 * @param {Boolean} [options.includeAccessCode=false] - Include access_code (POST/DELETE only).
 * @returns {Object} The serialized card.
 */
function serializeCard(card, { includeAccessCode = false } = {}) {
  const out = {
    id: card._id,
    title: card.title,
    description: card.description ?? null,
    slug: card.slug,
    creator_reference: card.creator_reference,
    links: Array.isArray(card.links) ? card.links : [],
    service_rates: card.service_rates ?? null,
    status: card.status,
    access_type: card.access_type ?? 'public',
  };

  if (includeAccessCode) {
    out.access_code = card.access_code ?? null;
  }

  out.created = card.created;
  out.updated = card.updated;
  out.deleted = card.deleted ? card.deleted : null; // paranoid 0 -> null

  return out;
}

module.exports = serializeCard;
