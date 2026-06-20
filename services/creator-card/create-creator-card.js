const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { CreatorCardMessages } = require('@app/messages');
const CreatorCard = require('@app/repository/creator-card');
const { assertCreateCardRules } = require('./assert-card-rules');
const generateSlug = require('./generate-slug');
const serializeCard = require('./serialize-card');

const M = CreatorCardMessages;

// Field-level validation spec. Parsed once at module load. Lengths/enums/required
// are enforced here; rules VSL cannot express are handled by assertCreateCardRules.
const createSpec = validator.parse(`root {
  title string<trim|minLength:3|maxLength:100>
  description? string<trim|maxLength:500>
  slug? string<trim|minLength:5|maxLength:50>
  creator_reference string<length:20>
  links[]? {
    title string<trim|minLength:1|maxLength:100>
    url string<trim|maxLength:200>
  }
  service_rates? {
    currency string(NGN|USD|GBP|GHS)
    rates[] {
      name string<trim|minLength:3|maxLength:100>
      description? string<trim|maxLength:250>
      amount number<min:1>
    }
  }
  status string(draft|published)
  access_type? string(public|private)
  access_code? string<length:6>
}`);

/**
 * Create a Creator Card.
 * @param {Object} serviceData - The raw create payload.
 * @returns {Promise<Object>} The serialized card (access_code included).
 */
async function createCreatorCard(serviceData) {
  const data = validator.validate(serviceData, createSpec);

  // Business rules the validator cannot express (AC01/AC05/charset/scheme/integer).
  assertCreateCardRules(data);

  // Normalise defaults at write time (the access checks read the stored values).
  const accessType = data.access_type ?? 'public';
  const accessCode = accessType === 'private' ? data.access_code : null;
  const links = data.links ?? [];
  const serviceRates = data.service_rates ?? null;

  // Resolve the slug: validate uniqueness for a client-provided slug (SL02),
  // otherwise auto-generate a unique one.
  let { slug } = data;
  if (slug) {
    const existing = await CreatorCard.findOne({ query: { slug } });
    if (existing) {
      throwAppError(M.SLUG_TAKEN, ERROR_CODE.VALIDATIONERR, { code: M.CODES.SL02 });
    }
  } else {
    slug = await generateSlug(CreatorCard, data.title);
  }

  const toCreate = {
    title: data.title,
    description: data.description,
    slug,
    creator_reference: data.creator_reference,
    links,
    service_rates: serviceRates,
    status: data.status,
    access_type: accessType,
    access_code: accessCode,
  };

  let created;
  try {
    // create() auto-sets _id (ULID), created and updated.
    created = await CreatorCard.create(toCreate);
  } catch (error) {
    // Safety net: a slug collision that races past the pre-check surfaces from the
    // unique index as DUPLICATE_RECORD (409). Re-shape it as SL02 (400) per spec.
    if (error.errorCode === ERROR_CODE.DUPLRCRD) {
      throwAppError(M.SLUG_TAKEN, ERROR_CODE.VALIDATIONERR, { code: M.CODES.SL02 });
    }
    throw error;
  }

  return serializeCard(created, { includeAccessCode: true });
}

module.exports = createCreatorCard;
