const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { CreatorCardMessages } = require('@app/messages');

const M = CreatorCardMessages;

const SLUG_REGEX = /^[a-zA-Z0-9_-]+$/;
const ACCESS_CODE_REGEX = /^[a-zA-Z0-9]{6}$/;

/**
 * Raise a generic field-level validation error (HTTP 400). VALIDATION_ERROR is not
 * present in the error->status mapping, so it falls through to 400. These plain
 * field-format failures do not carry one of the seven custom business codes.
 * @param {String} message
 */
function throwValidationError(message) {
  throwAppError(message, ERROR_CODE.VALIDATIONERR, { details: [{ message }] });
}

/**
 * Enforce the Creator Card business rules that the VSL validator cannot express.
 * Runs after `validator.validate`, so all values are already type/length/enum checked.
 *
 * @param {Object} data - The validated create payload.
 */
function assertCreateCardRules(data) {
  const accessType = data.access_type ?? 'public';

  // slug charset (only when a client supplied one).
  if (data.slug != null && !SLUG_REGEX.test(data.slug)) {
    throwValidationError(M.INVALID_SLUG_CHARSET);
  }

  // Conditional access_code rules (custom coded errors).
  if (accessType === 'private' && !data.access_code) {
    throwAppError(M.ACCESS_CODE_REQUIRED, ERROR_CODE.VALIDATIONERR, { code: M.CODES.AC01 });
  }
  if (data.access_code && accessType !== 'private') {
    throwAppError(M.ACCESS_CODE_NOT_ALLOWED, ERROR_CODE.VALIDATIONERR, { code: M.CODES.AC05 });
  }

  // access_code must be exactly 6 alphanumeric chars (length already checked by VSL).
  if (data.access_code && !ACCESS_CODE_REGEX.test(data.access_code)) {
    throwValidationError(M.INVALID_ACCESS_CODE_FORMAT);
  }

  // Every link url must start with http:// or https:// (VSL `startsWith` cannot OR).
  (data.links || []).forEach((link) => {
    const url = link.url || '';
    if (!(url.startsWith('http://') || url.startsWith('https://'))) {
      throwValidationError(M.INVALID_LINK_URL);
    }
  });

  // service_rates, when present, must have a non-empty rates array of positive integers.
  if (data.service_rates) {
    const rates = data.service_rates.rates || [];
    if (rates.length === 0) {
      throwValidationError(M.EMPTY_SERVICE_RATES);
    }
    rates.forEach((rate) => {
      if (!Number.isInteger(rate.amount) || rate.amount < 1) {
        throwValidationError(M.INVALID_RATE_AMOUNT);
      }
    });
  }
}

module.exports = { assertCreateCardRules, SLUG_REGEX, ACCESS_CODE_REGEX };
