const { expect } = require('chai');
const { server, stub, revertStubs, VALID_REF, validCreatePayload } = require('./helper');

describe('POST /creator-cards', () => {
  afterEach(revertStubs);

  describe('success', () => {
    it('creates a public card (200) with the exact envelope and auto-generated slug', async () => {
      stub({ method: 'findOne', mockNull: true }); // slug available
      const res = await server.post('/creator-cards', { body: validCreatePayload() });

      expect(res.statusCode).to.equal(200);
      expect(res.data.status).to.equal('success');
      expect(res.data.message).to.equal('Creator Card Created Successfully.');

      const card = res.data.data;
      expect(card).to.have.property('id').that.is.a('string');
      expect(card).to.not.have.property('_id');
      expect(card.slug).to.equal('george-cooks');
      expect(card.access_type).to.equal('public');
      expect(card.deleted).to.equal(null);
      expect(card.links).to.deep.equal([]);
      expect(card.service_rates).to.equal(null);
      // access_code IS included on create (null for public cards).
      expect(card).to.have.property('access_code', null);
      // description is always present (null when absent).
      expect(card).to.have.property('description', null);
    });

    it('honours a client-provided slug when available', async () => {
      stub({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: validCreatePayload({ slug: 'custom-handle' }),
      });

      expect(res.statusCode).to.equal(200);
      expect(res.data.data.slug).to.equal('custom-handle');
    });

    it('creates a private card and returns its access_code', async () => {
      stub({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: validCreatePayload({ access_type: 'private', access_code: 'A1B2C3' }),
      });

      expect(res.statusCode).to.equal(200);
      expect(res.data.data.access_type).to.equal('private');
      expect(res.data.data.access_code).to.equal('A1B2C3');
    });

    it('round-trips description, links and service_rates', async () => {
      stub({ method: 'findOne', mockNull: true });
      const body = validCreatePayload({
        description: 'Weekly cooking podcast',
        links: [{ title: 'Site', url: 'https://example.com' }],
        service_rates: {
          currency: 'USD',
          rates: [{ name: 'IG Story Post', description: 'A story', amount: 5000 }],
        },
      });
      const res = await server.post('/creator-cards', { body });

      expect(res.statusCode).to.equal(200);
      expect(res.data.data.description).to.equal('Weekly cooking podcast');
      expect(res.data.data.links).to.deep.equal([{ title: 'Site', url: 'https://example.com' }]);
      expect(res.data.data.service_rates.currency).to.equal('USD');
      expect(res.data.data.service_rates.rates[0].amount).to.equal(5000);
    });

    it('caps an auto-generated slug for a long title to the 5-50 char limit', async () => {
      stub({ method: 'findOne', mockNull: true }); // generated slug is available
      const longTitle =
        'The Ultimate Guide To Cooking Delicious Meals For Your Whole Family Every Day';
      const res = await server.post('/creator-cards', {
        body: validCreatePayload({ title: longTitle }),
      });

      expect(res.statusCode).to.equal(200);
      const { slug } = res.data.data;
      expect(slug.length).to.be.at.least(5);
      expect(slug.length).to.be.at.most(50);
      expect(slug).to.match(/^[a-zA-Z0-9_-]+$/);
    });
  });

  describe('business-rule errors', () => {
    it('SL02 when a client-provided slug is already taken (400)', async () => {
      stub({ method: 'findOne', docConfig: { slug: 'taken-handle' } }); // findOne -> existing card
      const res = await server.post('/creator-cards', {
        body: validCreatePayload({ slug: 'taken-handle' }),
      });

      expect(res.statusCode).to.equal(400);
      expect(res.data).to.deep.equal({
        status: 'error',
        message: 'Slug is already taken',
        code: 'SL02',
      });
    });

    it('SL02 when a slug collision races past the pre-check (unique index -> 409 reshaped to 400)', async () => {
      stub({ method: 'findOne', mockNull: true }); // pre-check passes
      stub({ method: 'create', mockDuplicateRecord: true }); // DB unique index trips
      const res = await server.post('/creator-cards', {
        body: validCreatePayload({ slug: 'racey-handle' }),
      });

      expect(res.statusCode).to.equal(400);
      expect(res.data.code).to.equal('SL02');
    });

    it('AC01 when access_type is private but access_code is missing (400)', async () => {
      stub({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: validCreatePayload({ access_type: 'private' }),
      });

      expect(res.statusCode).to.equal(400);
      expect(res.data.code).to.equal('AC01');
      expect(res.data.message).to.equal('access_code is required when access_type is private');
    });

    it('AC05 when access_code is set on a public card (400, message mentions private)', async () => {
      stub({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: validCreatePayload({ access_type: 'public', access_code: 'A1B2C3' }),
      });

      expect(res.statusCode).to.equal(400);
      expect(res.data.code).to.equal('AC05');
      expect(res.data.message).to.equal('access_code can only be set on private cards');
    });
  });

  describe('field-level validation (HTTP 400, no custom code)', () => {
    const cases = [
      ['missing title', { title: undefined }],
      ['title too short', { title: 'ab' }],
      ['creator_reference not exactly 20 chars', { creator_reference: 'too-short' }],
      ['T10: invalid status enum', { status: 'archived' }],
      [
        'invalid currency enum',
        { service_rates: { currency: 'EUR', rates: [{ name: 'Basic', amount: 100 }] } },
      ],
      ['empty rates array', { service_rates: { currency: 'USD', rates: [] } }],
      [
        'non-integer amount',
        { service_rates: { currency: 'USD', rates: [{ name: 'Basic', amount: 1.5 }] } },
      ],
      [
        'zero amount',
        { service_rates: { currency: 'USD', rates: [{ name: 'Basic', amount: 0 }] } },
      ],
      ['invalid slug charset', { slug: 'has spaces!' }],
      ['non-http link url', { links: [{ title: 'X', url: 'ftp://example.com' }] }],
      ['access_code wrong length', { access_type: 'private', access_code: 'ABCDE' }],
    ];

    cases.forEach(([name, override]) => {
      it(`returns 400 for ${name}`, async () => {
        stub({ method: 'findOne', mockNull: true });
        const body = validCreatePayload(override);
        if (override.title === undefined) delete body.title;
        const res = await server.post('/creator-cards', { body });

        expect(res.statusCode).to.equal(400);
        expect(res.data.status).to.equal('error');
        expect(res.data.message).to.be.a('string');
        expect(res.data.message.length).to.be.greaterThan(0);
        expect(res.data).to.not.have.property('code'); // field-level errors carry no custom code
      });
    });
  });

  describe('site sample body & exact response contract (T1)', () => {
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

    it('T1: creates a full card from the sample body and returns the exact ordered field set', async () => {
      stub({ method: 'findOne', mockNull: true });
      const body = {
        title: 'George Cooks',
        description: 'George Cooks is a weekly cooking podcast by Chef George AmadiObi',
        slug: 'george-cooks',
        creator_reference: VALID_REF,
        links: [
          { title: 'YouTube Channel', url: 'https://youtube.com/@georgecooks' },
          { title: 'Instagram', url: 'https://instagram.com/georgecooks' },
        ],
        service_rates: {
          currency: 'NGN',
          rates: [
            { name: 'IG Story Post', description: 'One Instagram story mention', amount: 5000000 },
            { name: 'Recipe Feature', description: 'Featured segment', amount: 15000000 },
          ],
        },
        status: 'published',
        access_type: 'public',
      };
      const res = await server.post('/creator-cards', { body });
      const card = res.data.data;

      expect(res.statusCode).to.equal(200);
      expect(res.data.status).to.equal('success');
      expect(res.data.message).to.equal('Creator Card Created Successfully.');
      expect(Object.keys(card)).to.deep.equal(FULL_KEYS); // access_code present, exact order
      expect(card).to.not.have.property('_id');
      expect(card.title).to.equal('George Cooks');
      expect(card.slug).to.equal('george-cooks');
      expect(card.creator_reference).to.equal(VALID_REF);
      expect(card.links).to.have.lengthOf(2);
      expect(card.service_rates.currency).to.equal('NGN');
      expect(card.service_rates.rates[1].amount).to.equal(15000000);
      expect(card.access_type).to.equal('public');
      expect(card.access_code).to.equal(null);
      expect(card.deleted).to.equal(null);
    });

    it('T1: created and updated are equal Unix-ms numbers', async () => {
      stub({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', { body: validCreatePayload() });
      const card = res.data.data;
      expect(card.created).to.be.a('number').and.greaterThan(0);
      expect(card.updated).to.be.a('number').and.greaterThan(0);
      expect(card.created).to.equal(card.updated);
    });

    it('T1: access_type defaults to "public" and access_code to null when omitted', async () => {
      stub({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', { body: validCreatePayload() });
      expect(res.data.data.access_type).to.equal('public');
      expect(res.data.data).to.have.property('access_code', null);
    });
  });

  describe('access_type / access_code conditional matrix', () => {
    const rows = [
      ['T3: private + code -> 200', { access_type: 'private', access_code: 'A1B2C3' }, 200, null],
      ['T8: private + no code -> 400 AC01', { access_type: 'private' }, 400, 'AC01'],
      [
        'T9: public + code -> 400 AC05',
        { access_type: 'public', access_code: 'A1B2C3' },
        400,
        'AC05',
      ],
      ['public + no code -> 200', { access_type: 'public' }, 200, null],
      ['T9: omitted access_type + code -> 400 AC05', { access_code: 'A1B2C3' }, 400, 'AC05'],
      ['omitted access_type + no code -> 200', {}, 200, null],
    ];

    rows.forEach(([name, override, status, code]) => {
      it(name, async () => {
        stub({ method: 'findOne', mockNull: true });
        const res = await server.post('/creator-cards', { body: validCreatePayload(override) });
        expect(res.statusCode).to.equal(status);
        if (code) {
          expect(res.data.code).to.equal(code);
        } else {
          expect(res.data.status).to.equal('success');
          expect(res.data.data.access_code).to.equal(override.access_code || null);
        }
      });
    });
  });

  describe('slug auto-generation (T2)', () => {
    it('T2: auto-generates "ada-designs-things" from the title', async () => {
      stub({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: {
          title: 'Ada Designs Things',
          creator_reference: 'crt_a1b2c3d4e5f6g7h8',
          status: 'published',
        },
      });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data.slug).to.equal('ada-designs-things');
    });

    it('T2: a short title ("Cook") gets a "-<6 alnum>" suffix', async () => {
      stub({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: { title: 'Cook', creator_reference: VALID_REF, status: 'published' },
      });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data.slug).to.match(/^cook-[a-z0-9]{6}$/);
    });
  });

  describe('valid boundary values (HTTP 200)', () => {
    const rows = [
      ['title length 3 (min)', { title: 'abc' }],
      ['title length 100 (max)', { title: 'a'.repeat(100) }],
      ['title trims to 3', { title: '  abc  ' }],
      ['description length 500 (max)', { description: 'a'.repeat(500) }],
      ['client slug length 5 (min)', { slug: 'abcde' }],
      ['client slug length 50 (max)', { slug: 'a'.repeat(50) }],
      ['status draft', { status: 'draft' }],
      [
        'currency GBP',
        { service_rates: { currency: 'GBP', rates: [{ name: 'Plan X', amount: 1 }] } },
      ],
      [
        'currency GHS',
        { service_rates: { currency: 'GHS', rates: [{ name: 'Plan X', amount: 99 }] } },
      ],
      [
        'amount exactly 1 (min)',
        { service_rates: { currency: 'USD', rates: [{ name: 'Plan X', amount: 1 }] } },
      ],
      ['private + lowercase alnum access_code', { access_type: 'private', access_code: 'abc123' }],
      ['link url http://', { links: [{ title: 'X', url: 'http://example.com' }] }],
    ];

    rows.forEach(([name, override]) => {
      it(`accepts ${name}`, async () => {
        stub({ method: 'findOne', mockNull: true });
        const res = await server.post('/creator-cards', { body: validCreatePayload(override) });
        expect(res.statusCode).to.equal(200);
        expect(res.data.status).to.equal('success');
      });
    });
  });

  describe('invalid boundary values (HTTP 400, no custom code)', () => {
    const rows = [
      ['title length 101', { title: 'a'.repeat(101) }],
      ['title trims to 2', { title: 'ab ' }],
      ['title non-string', { title: 123 }],
      ['description length 501', { description: 'a'.repeat(501) }],
      ['client slug length 4', { slug: 'abcd' }],
      ['client slug length 51', { slug: 'a'.repeat(51) }],
      ['client slug bad charset', { slug: 'bad!chars' }],
      ['client slug unicode', { slug: 'café-naïve' }],
      ['creator_reference length 19', { creator_reference: 'a'.repeat(19) }],
      ['creator_reference length 21', { creator_reference: 'a'.repeat(21) }],
      ['link title length 0', { links: [{ title: '', url: 'https://x.com' }] }],
      ['link title length 101', { links: [{ title: 'a'.repeat(101), url: 'https://x.com' }] }],
      ['link url empty', { links: [{ title: 'X', url: '' }] }],
      ['link url uppercase scheme', { links: [{ title: 'X', url: 'HTTP://x.com' }] }],
      ['link url relative', { links: [{ title: 'X', url: '/relative' }] }],
      ['link url length 201', { links: [{ title: 'X', url: `https://e.com/${'a'.repeat(201)}` }] }],
      [
        'second link url bad',
        {
          links: [
            { title: 'A', url: 'https://a' },
            { title: 'B', url: 'ftp://b' },
          ],
        },
      ],
      [
        'currency lowercase',
        { service_rates: { currency: 'ngn', rates: [{ name: 'Plan X', amount: 5 }] } },
      ],
      ['currency omitted', { service_rates: { rates: [{ name: 'Plan X', amount: 5 }] } }],
      [
        'rate name length 2',
        { service_rates: { currency: 'USD', rates: [{ name: 'ab', amount: 5 }] } },
      ],
      [
        'rate name length 101',
        { service_rates: { currency: 'USD', rates: [{ name: 'a'.repeat(101), amount: 5 }] } },
      ],
      [
        'rate description length 251',
        {
          service_rates: {
            currency: 'USD',
            rates: [{ name: 'Plan X', description: 'a'.repeat(251), amount: 5 }],
          },
        },
      ],
      [
        'amount -5',
        { service_rates: { currency: 'USD', rates: [{ name: 'Plan X', amount: -5 }] } },
      ],
      [
        'amount 2.5 (non-integer)',
        { service_rates: { currency: 'USD', rates: [{ name: 'Plan X', amount: 2.5 }] } },
      ],
      [
        'amount string "100"',
        { service_rates: { currency: 'USD', rates: [{ name: 'Plan X', amount: '100' }] } },
      ],
      ['status uppercase', { status: 'PUBLISHED' }],
      ['access_code length 7', { access_type: 'private', access_code: 'A1B2C34' }],
      ['access_code 6 non-alnum', { access_type: 'private', access_code: 'A1B2C!' }],
      ['access_code empty on private', { access_type: 'private', access_code: '' }],
      ['access_type invalid enum', { access_type: 'unlisted' }],
    ];

    rows.forEach(([name, override]) => {
      it(`rejects ${name}`, async () => {
        stub({ method: 'findOne', mockNull: true });
        const res = await server.post('/creator-cards', { body: validCreatePayload(override) });
        expect(res.statusCode).to.equal(400);
        expect(res.data.status).to.equal('error');
        expect(res.data).to.not.have.property('code');
      });
    });
  });

  describe('precedence & race', () => {
    it('a VSL field failure pre-empts AC01 (plain 400, no code)', async () => {
      stub({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: validCreatePayload({ title: 'ab', access_type: 'private' }), // no access_code + bad title
      });
      expect(res.statusCode).to.equal(400);
      expect(res.data).to.not.have.property('code');
    });

    it('the DUPLRCRD race path returns the exact SL02 envelope', async () => {
      stub({ method: 'findOne', mockNull: true });
      stub({ method: 'create', mockDuplicateRecord: true });
      const res = await server.post('/creator-cards', {
        body: validCreatePayload({ slug: 'racey-handle' }),
      });
      expect(res.statusCode).to.equal(400);
      expect(res.data).to.deep.equal({
        status: 'error',
        message: 'Slug is already taken',
        code: 'SL02',
      });
    });
  });
});
