const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { CreatorCardMessages } = require('@app/messages');
const CreatorCard = require('@app/repository/creator-card');
const serializeCard = require('./serialize-card');

const M = CreatorCardMessages;

const deleteSpec = validator.parse(`root {
  creator_reference string<length:20>
}`);

/**
 * Soft-delete a Creator Card by slug, verified by creator_reference.
 *
 * @param {Object} serviceData
 * @param {String} serviceData.slug - The card slug (from the URL path).
 * @param {String} serviceData.creator_reference - Owner reference (exactly 20 chars).
 * @returns {Promise<Object>} The serialized deleted card (access_code included,
 *                            deleted set to the persisted timestamp).
 */
async function deleteCreatorCard(serviceData) {
  const { slug } = serviceData;
  const { creator_reference: creatorReference } = validator.validate(
    { creator_reference: serviceData.creator_reference },
    deleteSpec
  );

  const card = await CreatorCard.findOne({ query: { slug } });

  // Not found OR owned by someone else -> NF01 (do not leak existence).
  if (!card || card.creator_reference !== creatorReference) {
    throwAppError(M.CARD_NOT_FOUND, ERROR_CODE.NOTFOUND, { code: M.CODES.NF01 });
  }

  // Paranoid soft-delete: sets `deleted` to a timestamp and mangles the unique slug
  // so the value is freed. It returns only a write result, not the document.
  await CreatorCard.deleteOne({ query: { slug } });

  // Read back the real persisted `deleted` timestamp, bypassing the paranoid filter
  // (raw() = native model). The `findOne(filter, null, { lean: true })` form is
  // portable across the real driver and the mock model.
  const fallbackTs = Date.now();
  let persistedDeleted = fallbackTs;
  try {
    const fresh = await CreatorCard.raw().findOne({ _id: card._id }, null, { lean: true });
    if (fresh && typeof fresh.deleted === 'number' && fresh.deleted > 0) {
      persistedDeleted = fresh.deleted;
    }
  } catch (error) {
    // Fall back to the locally captured timestamp if the re-fetch is unavailable.
    persistedDeleted = fallbackTs;
  }

  // Serialize from the pre-fetched card (keeps the ORIGINAL slug; the stored one is
  // now mangled) with the real deleted timestamp overlaid.
  return serializeCard({ ...card, deleted: persistedDeleted }, { includeAccessCode: true });
}

module.exports = deleteCreatorCard;
