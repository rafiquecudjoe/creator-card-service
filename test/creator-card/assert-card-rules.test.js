const { expect } = require('chai');
const {
  assertCreateCardRules,
  SLUG_REGEX,
  ACCESS_CODE_REGEX,
} = require('../../services/creator-card/assert-card-rules');

// Run the assertion and return the thrown error (or null if it did not throw).
function grab(input) {
  try {
    assertCreateCardRules(input);
    return null;
  } catch (e) {
    return e;
  }
}

describe('assertCreateCardRules (unit)', () => {
  describe('coded business errors', () => {
    it('AC01: private without access_code -> code AC01 + exact message', () => {
      const err = grab({ access_type: 'private' });
      expect(err.code).to.equal('AC01');
      expect(err.message).to.equal('access_code is required when access_type is private');
    });

    it('AC05: access_code on a public card -> code AC05 + exact message', () => {
      const err = grab({ access_type: 'public', access_code: 'A1B2C3' });
      expect(err.code).to.equal('AC05');
      expect(err.message).to.equal('access_code can only be set on private cards');
    });

    it('AC05 also fires when access_type is omitted (defaults to public)', () => {
      expect(grab({ access_code: 'A1B2C3' }).code).to.equal('AC05');
    });
  });

  describe('field-level errors (no custom code)', () => {
    it('invalid slug charset -> exact message, no code', () => {
      const err = grab({ slug: 'has space!' });
      expect(err.message).to.equal(
        'slug may only contain letters, numbers, hyphens and underscores'
      );
      expect(err.code).to.equal(undefined);
    });

    it('does not check slug charset when slug is null', () => {
      expect(grab({ slug: null })).to.equal(null);
    });

    it('access_code present but not 6 alphanumeric -> exact message, no code', () => {
      const err = grab({ access_type: 'private', access_code: 'A1B2C!' });
      expect(err.message).to.equal('access_code must be exactly 6 alphanumeric characters');
      expect(err.code).to.equal(undefined);
    });

    it('link url with a non-http(s) scheme -> exact message', () => {
      const err = grab({ links: [{ title: 'X', url: 'ftp://x' }] });
      expect(err.message).to.equal('link url must start with http:// or https://');
    });

    it('link url missing -> treated as empty -> same message', () => {
      expect(grab({ links: [{ title: 'X' }] }).message).to.equal(
        'link url must start with http:// or https://'
      );
    });

    it('accepts http:// and https:// link urls', () => {
      expect(grab({ links: [{ url: 'http://x' }, { url: 'https://y' }] })).to.equal(null);
    });

    it('empty service_rates.rates -> exact message (VSL shadows this at the endpoint)', () => {
      const err = grab({ service_rates: { currency: 'USD', rates: [] } });
      expect(err.message).to.equal('service_rates.rates must contain at least one rate');
    });

    it('service_rates with missing rates array -> same message', () => {
      expect(grab({ service_rates: { currency: 'USD' } }).message).to.equal(
        'service_rates.rates must contain at least one rate'
      );
    });

    it('non-integer rate amount -> exact message', () => {
      const err = grab({ service_rates: { rates: [{ amount: 1.5 }] } });
      expect(err.message).to.equal('amount must be a positive integer in minor units');
    });

    it('rate amount < 1 -> same message', () => {
      expect(grab({ service_rates: { rates: [{ amount: 0 }] } }).message).to.equal(
        'amount must be a positive integer in minor units'
      );
    });
  });

  describe('happy path', () => {
    it('a fully valid private payload passes without throwing', () => {
      const err = grab({
        access_type: 'private',
        access_code: 'A1B2C3',
        slug: 'ok-slug',
        links: [{ url: 'https://x' }],
        service_rates: { rates: [{ amount: 5 }] },
      });
      expect(err).to.equal(null);
    });

    it('an empty payload (all optional rules skipped) passes', () => {
      expect(grab({})).to.equal(null);
    });
  });

  describe('exported regexes', () => {
    it('SLUG_REGEX matches the slug charset', () => {
      expect(SLUG_REGEX.test('A_b-1')).to.equal(true);
      expect(SLUG_REGEX.test('a b')).to.equal(false);
      expect(SLUG_REGEX.test('a!b')).to.equal(false);
    });

    it('ACCESS_CODE_REGEX matches exactly 6 alphanumeric chars', () => {
      expect(ACCESS_CODE_REGEX.test('A1B2C3')).to.equal(true);
      expect(ACCESS_CODE_REGEX.test('abc123')).to.equal(true);
      expect(ACCESS_CODE_REGEX.test('A1B2C')).to.equal(false);
      expect(ACCESS_CODE_REGEX.test('A1B2C34')).to.equal(false);
      expect(ACCESS_CODE_REGEX.test('A1B2C!')).to.equal(false);
    });
  });
});
