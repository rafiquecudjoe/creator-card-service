const { ModelSchema, SchemaTypes, DatabaseModel } = require('@app-core/mongoose');

const modelName = 'creatorcards';

/**
 * @typedef {Object} ModelSchema
 * @property {String} _id ULID. Stored as _id in MongoDB, exposed as `id` in API responses.
 * @property {String} title 3-100 chars (length enforced in the service VSL spec).
 * @property {String} description <=500 chars, optional.
 * @property {String} slug 5-50 chars, [a-zA-Z0-9_-], unique. Auto-generated when omitted.
 * @property {String} creator_reference Exactly 20 chars. Owner identity on the consuming service.
 * @property {Array} links [{ title, url }] showcase links.
 * @property {Object} service_rates { currency, rates: [{ name, description, amount }] }.
 * @property {String} status draft | published.
 * @property {String} access_type public | private (defaults to public).
 * @property {String} access_code Exactly 6 alphanumeric chars; null unless access_type is private.
 * @property {Number} created Unix epoch milliseconds (auto-set on create).
 * @property {Number} updated Unix epoch milliseconds (auto-set on create).
 * @property {Number} deleted 0 while live (paranoid), Unix ms timestamp when soft-deleted.
 */

// Models hold DB-level concerns only (structure, required, indexing, defaults, the ULID _id).
// Lengths, enums, formats and cross-field rules live in the service VSL spec / business rules.
const schemaConfig = {
  _id: { type: SchemaTypes.ULID, required: true },
  title: { type: SchemaTypes.String, required: true },
  description: { type: SchemaTypes.String },
  slug: { type: SchemaTypes.String, required: true, unique: true, index: true },
  creator_reference: { type: SchemaTypes.String, required: true, index: true },
  links: { type: SchemaTypes.Array, default: [] },
  service_rates: { type: SchemaTypes.Mixed, default: null },
  status: { type: SchemaTypes.String, required: true, index: true },
  access_type: { type: SchemaTypes.String, required: true, default: 'public' },
  access_code: { type: SchemaTypes.String, default: null },
  created: { type: SchemaTypes.Number },
  updated: { type: SchemaTypes.Number },
  // `deleted` (Number, default 0, indexed) is injected by { paranoid: true }.
};

const modelSchema = new ModelSchema(schemaConfig, { collection: modelName });

/** @type {ModelSchema} */
module.exports = DatabaseModel.model('CreatorCard', modelSchema, { paranoid: true });
