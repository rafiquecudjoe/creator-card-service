// Business-facing error codes for the Creator Card service. These are the only
// seven custom codes defined by the assessment and are surfaced as the flat
// top-level `code` on error responses.
const CODES = {
  SL02: 'SL02', // slug already taken
  AC01: 'AC01', // access_type private but access_code missing
  AC05: 'AC05', // access_code set on a public card
  NF01: 'NF01', // card not found (or deleted)
  NF02: 'NF02', // card exists but is a draft
  AC03: 'AC03', // private card accessed without access_code
  AC04: 'AC04', // private card accessed with wrong access_code
};

module.exports = {
  CODES,

  // Success messages (verbatim per the assessment).
  CARD_CREATED: 'Creator Card Created Successfully.',
  CARD_RETRIEVED: 'Creator Card Retrieved Successfully.',
  CARD_DELETED: 'Creator Card Deleted Successfully.',

  // Error messages.
  SLUG_TAKEN: 'Slug is already taken',
  ACCESS_CODE_REQUIRED: 'access_code is required when access_type is private',
  ACCESS_CODE_NOT_ALLOWED: 'access_code can only be set on private cards',
  CARD_NOT_FOUND: 'Creator card not found',
  CARD_IS_PRIVATE: 'This card is private. An access code is required',
  INVALID_ACCESS_CODE: 'Invalid access code',

  // Generic field-level validation messages (manual rules VSL cannot express).
  INVALID_SLUG_CHARSET: 'slug may only contain letters, numbers, hyphens and underscores',
  INVALID_ACCESS_CODE_FORMAT: 'access_code must be exactly 6 alphanumeric characters',
  INVALID_LINK_URL: 'link url must start with http:// or https://',
  INVALID_RATE_AMOUNT: 'amount must be a positive integer in minor units',
  EMPTY_SERVICE_RATES: 'service_rates.rates must contain at least one rate',
};
