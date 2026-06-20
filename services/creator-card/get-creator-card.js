const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { CreatorCardMessages } = require('@app/messages');
const CreatorCard = require('@app/repository/creator-card');
const serializeCard = require('./serialize-card');

const M = CreatorCardMessages;

/**
 * Retrieve a Creator Card by slug, enforcing the access-control ladder
 * (first match wins): NF01 -> NF02 -> AC03 -> AC04 -> 200.
 *
 * @param {Object} serviceData
 * @param {String} serviceData.slug - The card slug (from the URL path).
 * @param {String} [serviceData.access_code] - Optional access code (private cards).
 * @returns {Promise<Object>} The serialized card (access_code omitted).
 */
async function getCreatorCard(serviceData) {
  const { slug } = serviceData;
  // Treat empty/whitespace/non-string query values as "no code supplied".
  const accessCode =
    typeof serviceData.access_code === 'string' && serviceData.access_code.trim() !== ''
      ? serviceData.access_code
      : undefined;

  // findOne auto-filters `deleted: 0`, so soft-deleted cards are already invisible.
  const card = await CreatorCard.findOne({ query: { slug } });

  if (!card) {
    throwAppError(M.CARD_NOT_FOUND, ERROR_CODE.NOTFOUND, { code: M.CODES.NF01 });
  }

  if (card.status === 'draft') {
    throwAppError(M.CARD_NOT_FOUND, ERROR_CODE.NOTFOUND, { code: M.CODES.NF02 });
  }

  if (card.access_type === 'private') {
    if (!accessCode) {
      throwAppError(M.CARD_IS_PRIVATE, ERROR_CODE.INVLDREQ, { code: M.CODES.AC03 });
    }
    if (accessCode !== card.access_code) {
      throwAppError(M.INVALID_ACCESS_CODE, ERROR_CODE.INVLDREQ, { code: M.CODES.AC04 });
    }
  }

  return serializeCard(card, { includeAccessCode: false });
}

module.exports = getCreatorCard;
