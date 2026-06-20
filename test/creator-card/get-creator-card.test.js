const { expect } = require('chai');
const { server, stub, revertStubs } = require('./helper');
const getCreatorCard = require('../../services/creator-card/get-creator-card');

const publishedPublic = {
  slug: 'george-cooks',
  status: 'published',
  access_type: 'public',
  access_code: null,
};
const publishedPrivate = {
  slug: 'secret',
  status: 'published',
  access_type: 'private',
  access_code: 'A1B2C3',
};

describe('GET /creator-cards/:slug', () => {
  afterEach(revertStubs);

  describe('success', () => {
    it('retrieves a public published card (200) and OMITS access_code', async () => {
      stub({ method: 'findOne', docConfig: publishedPublic });
      const res = await server.get('/creator-cards/george-cooks', {});

      expect(res.statusCode).to.equal(200);
      expect(res.data.status).to.equal('success');
      expect(res.data.message).to.equal('Creator Card Retrieved Successfully.');

      const card = res.data.data;
      expect(card).to.not.have.property('access_code'); // omitted entirely on GET
      expect(card).to.not.have.property('_id');
      expect(card).to.have.property('id');
      expect(card).to.have.property('description'); // always present
      expect(card.slug).to.equal('george-cooks');
      expect(card.deleted).to.equal(null);
    });

    it('T5: retrieves a private card when the correct access_code is supplied via query', async () => {
      stub({ method: 'findOne', docConfig: publishedPrivate });
      const res = await server.get('/creator-cards/secret', { query: { access_code: 'A1B2C3' } });

      expect(res.statusCode).to.equal(200);
      expect(res.data.data.access_type).to.equal('private');
      expect(res.data.data).to.not.have.property('access_code');
    });
  });

  describe('access-control ladder', () => {
    it('T11: NF01 when the card does not exist (404)', async () => {
      stub({ method: 'findOne', mockNull: true });
      const res = await server.get('/creator-cards/missing', {});

      expect(res.statusCode).to.equal(404);
      expect(res.data).to.deep.equal({
        status: 'error',
        message: 'Creator card not found',
        code: 'NF01',
      });
    });

    it('NF02 when the card is a draft (404)', async () => {
      stub({
        method: 'findOne',
        docConfig: { slug: 'draft-card', status: 'draft', access_type: 'public' },
      });
      const res = await server.get('/creator-cards/draft-card', {});

      expect(res.statusCode).to.equal(404);
      expect(res.data.code).to.equal('NF02');
      expect(res.data.message).to.equal('Creator card not found');
    });

    it('AC03 when a private card is accessed without an access_code (403)', async () => {
      stub({ method: 'findOne', docConfig: publishedPrivate });
      const res = await server.get('/creator-cards/secret', {});

      expect(res.statusCode).to.equal(403);
      expect(res.data.code).to.equal('AC03');
      expect(res.data.message).to.equal('This card is private. An access code is required');
    });

    it('T14: AC04 when a private card is accessed with the wrong access_code (403)', async () => {
      stub({ method: 'findOne', docConfig: publishedPrivate });
      const res = await server.get('/creator-cards/secret', { query: { access_code: 'WRONG1' } });

      expect(res.statusCode).to.equal(403);
      expect(res.data.code).to.equal('AC04');
      expect(res.data.message).to.equal('Invalid access code');
    });
  });

  describe('field contract depth (T4)', () => {
    it('T4: omits access_code and _id, exposes id, keeps description, deleted null', async () => {
      stub({ method: 'findOne', docConfig: { ...publishedPublic, description: 'A bio' } });
      const res = await server.get('/creator-cards/george-cooks', {});
      const card = res.data.data;

      expect(res.statusCode).to.equal(200);
      expect(card).to.not.have.property('access_code'); // omitted entirely on GET
      expect(card).to.not.have.property('_id');
      expect(card).to.have.property('id');
      expect(card).to.have.own.property('description'); // always present
      expect(card.slug).to.equal('george-cooks');
      expect(card.deleted).to.equal(null);
      // documented data fields are all present
      [
        'id',
        'title',
        'description',
        'slug',
        'creator_reference',
        'links',
        'service_rates',
        'status',
        'access_type',
      ].forEach((k) => expect(card).to.have.property(k));
    });

    it('a public card ignores a supplied access_code and returns 200 (no leak)', async () => {
      stub({ method: 'findOne', docConfig: publishedPublic });
      const res = await server.get('/creator-cards/george-cooks', {
        query: { access_code: 'WHATEVER' },
      });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data).to.not.have.property('access_code');
    });
  });

  describe('access-control ladder — precedence & normalization', () => {
    it('T12: draft + private (no code) returns NF02, not AC03', async () => {
      stub({
        method: 'findOne',
        docConfig: { slug: 'dp', status: 'draft', access_type: 'private', access_code: 'A1B2C3' },
      });
      const res = await server.get('/creator-cards/dp', {});
      expect(res.statusCode).to.equal(404);
      expect(res.data.code).to.equal('NF02');
    });

    it('a draft card is never retrievable, even with the correct access_code (NF02)', async () => {
      stub({
        method: 'findOne',
        docConfig: { slug: 'dp2', status: 'draft', access_type: 'private', access_code: 'A1B2C3' },
      });
      const res = await server.get('/creator-cards/dp2', { query: { access_code: 'A1B2C3' } });
      expect(res.statusCode).to.equal(404);
      expect(res.data.code).to.equal('NF02');
    });

    it('T16: a soft-deleted (invisible) card returns NF01', async () => {
      stub({ method: 'findOne', mockNull: true }); // paranoid filter hides deleted rows
      const res = await server.get('/creator-cards/was-deleted', {});
      expect(res.statusCode).to.equal(404);
      expect(res.data.code).to.equal('NF01');
    });

    ['', '   ', '\t'].forEach((blank) => {
      it(`T13: a blank access_code query (${JSON.stringify(blank)}) is treated as no code -> AC03`, async () => {
        stub({ method: 'findOne', docConfig: publishedPrivate });
        const res = await server.get('/creator-cards/secret', { query: { access_code: blank } });
        expect(res.statusCode).to.equal(403);
        expect(res.data.code).to.equal('AC03');
      });
    });

    it('a non-string access_code (array) is treated as no code -> AC03', async () => {
      stub({ method: 'findOne', docConfig: publishedPrivate });
      let thrown = null;
      try {
        await getCreatorCard({ slug: 'secret', access_code: ['A1B2C3'] });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).to.not.equal(null);
      expect(thrown.code).to.equal('AC03');
    });
  });
});
