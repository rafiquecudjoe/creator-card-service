const { expect } = require('chai');
const serializeCard = require('../../services/creator-card/serialize-card');

// A complete lean DB record (paranoid live row has deleted === 0).
const RECORD = {
  _id: '01JG8XYZA2B3C4D5E6F7G8H9J0',
  title: 'George Cooks',
  description: 'George Cooks is a weekly cooking podcast by Chef George AmadiObi',
  slug: 'george-cooks',
  creator_reference: 'crt_8f2k1m9x4p7w3q5z',
  links: [{ title: 'YouTube Channel', url: 'https://youtube.com/@georgecooks' }],
  service_rates: { currency: 'NGN', rates: [{ name: 'IG Story Post', amount: 5000000 }] },
  status: 'published',
  access_type: 'public',
  access_code: null,
  created: 1767052800000,
  updated: 1767052800000,
  deleted: 0,
};

// The true wire contract (a complete record carries created/updated).
const GET_KEYS = [
  'id',
  'title',
  'description',
  'slug',
  'creator_reference',
  'links',
  'service_rates',
  'status',
  'access_type',
  'created',
  'updated',
  'deleted',
];
const FULL_KEYS = [
  'id',
  'title',
  'description',
  'slug',
  'creator_reference',
  'links',
  'service_rates',
  'status',
  'access_type',
  'access_code',
  'created',
  'updated',
  'deleted',
];

describe('serializeCard (unit)', () => {
  it('maps _id -> id and never exposes _id', () => {
    const out = serializeCard(RECORD);
    expect(out.id).to.equal('01JG8XYZA2B3C4D5E6F7G8H9J0');
    expect(out).to.not.have.property('_id');
  });

  it('GET shape: exact 12-key ordered field set, access_code OMITTED', () => {
    const out = serializeCard(RECORD, { includeAccessCode: false });
    expect(Object.keys(out)).to.deep.equal(GET_KEYS);
    expect(out).to.not.have.property('access_code');
  });

  it('POST/DELETE shape: exact 13-key ordered field set, access_code INCLUDED before created', () => {
    const out = serializeCard(RECORD, { includeAccessCode: true });
    expect(Object.keys(out)).to.deep.equal(FULL_KEYS);
    expect(out.access_code).to.equal(null);
  });

  it('deep-equals the documented sample POST response (deleted 0 -> null)', () => {
    const out = serializeCard(RECORD, { includeAccessCode: true });
    expect(out).to.deep.equal({
      id: '01JG8XYZA2B3C4D5E6F7G8H9J0',
      title: 'George Cooks',
      description: 'George Cooks is a weekly cooking podcast by Chef George AmadiObi',
      slug: 'george-cooks',
      creator_reference: 'crt_8f2k1m9x4p7w3q5z',
      links: [{ title: 'YouTube Channel', url: 'https://youtube.com/@georgecooks' }],
      service_rates: { currency: 'NGN', rates: [{ name: 'IG Story Post', amount: 5000000 }] },
      status: 'published',
      access_type: 'public',
      access_code: null,
      created: 1767052800000,
      updated: 1767052800000,
      deleted: null,
    });
  });

  it('includes a real access_code value when includeAccessCode is true', () => {
    const out = serializeCard({ ...RECORD, access_code: 'A1B2C3' }, { includeAccessCode: true });
    expect(out.access_code).to.equal('A1B2C3');
  });

  it('coalesces access_code to null when included but absent', () => {
    const out = serializeCard({ ...RECORD, access_code: undefined }, { includeAccessCode: true });
    expect(out.access_code).to.equal(null);
  });

  it('maps the paranoid deleted:0 sentinel to null', () => {
    expect(serializeCard({ ...RECORD, deleted: 0 }).deleted).to.equal(null);
  });

  it('passes a real deleted timestamp (>0) through unchanged', () => {
    const out = serializeCard({ ...RECORD, deleted: 1767139200000 }, { includeAccessCode: true });
    expect(out.deleted).to.equal(1767139200000);
    expect(out.deleted).to.be.a('number').and.greaterThan(0);
  });

  it('applies defaults: description->null, links->[], service_rates->null, access_type->"public"', () => {
    const out = serializeCard({
      _id: 'X',
      title: 'T',
      slug: 'a-slug',
      creator_reference: 'r',
      status: 'published',
      deleted: 0,
    });
    expect(out.description).to.equal(null);
    expect(out.links).to.deep.equal([]);
    expect(out.service_rates).to.equal(null);
    expect(out.access_type).to.equal('public');
  });

  it('coerces a non-array links value to []', () => {
    expect(serializeCard({ ...RECORD, links: 'nope' }).links).to.deep.equal([]);
  });

  it('always emits description as an own property (null when absent)', () => {
    const out = serializeCard({ ...RECORD, description: undefined });
    expect(out).to.have.own.property('description', null);
  });

  it('passes created and updated through verbatim as numbers', () => {
    const out = serializeCard(RECORD);
    expect(out.created).to.equal(1767052800000);
    expect(out.updated).to.equal(1767052800000);
    expect(out.created).to.be.a('number');
  });
});
