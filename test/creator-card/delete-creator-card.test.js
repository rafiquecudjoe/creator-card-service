const { expect } = require('chai');
const { server, stub, revertStubs, VALID_REF } = require('./helper');

describe('DELETE /creator-cards/:slug', () => {
  afterEach(revertStubs);

  it('soft-deletes a card (200) and returns it with a populated deleted timestamp + access_code', async () => {
    stub({
      method: 'findOne',
      docConfig: {
        slug: 'george-cooks',
        creator_reference: VALID_REF,
        status: 'published',
        access_type: 'public',
        access_code: null,
      },
    });

    const res = await server.delete('/creator-cards/george-cooks', {
      body: { creator_reference: VALID_REF },
    });

    expect(res.statusCode).to.equal(200);
    expect(res.data.status).to.equal('success');
    expect(res.data.message).to.equal('Creator Card Deleted Successfully.');

    const card = res.data.data;
    expect(card).to.have.property('access_code'); // included on delete
    expect(card.slug).to.equal('george-cooks'); // original slug, not the mangled one
    expect(card.deleted).to.be.a('number');
    expect(card.deleted).to.be.greaterThan(0);
  });

  it('NF01 when the card does not exist (404)', async () => {
    stub({ method: 'findOne', mockNull: true });
    const res = await server.delete('/creator-cards/missing', {
      body: { creator_reference: VALID_REF },
    });

    expect(res.statusCode).to.equal(404);
    expect(res.data).to.deep.equal({
      status: 'error',
      message: 'Creator card not found',
      code: 'NF01',
    });
  });

  it('NF01 when the creator_reference does not match the owner (404, no existence leak)', async () => {
    stub({
      method: 'findOne',
      docConfig: {
        slug: 'george-cooks',
        creator_reference: 'different-ref-here00',
        status: 'published',
      },
    });
    const res = await server.delete('/creator-cards/george-cooks', {
      body: { creator_reference: VALID_REF },
    });

    expect(res.statusCode).to.equal(404);
    expect(res.data.code).to.equal('NF01');
  });

  it('returns 400 when creator_reference is not exactly 20 chars', async () => {
    const res = await server.delete('/creator-cards/george-cooks', {
      body: { creator_reference: 'too-short' },
    });

    expect(res.statusCode).to.equal(400);
    expect(res.data.status).to.equal('error');
  });

  describe('response contract (T6)', () => {
    it('T6: private card delete returns access_code, the original slug, and a deleted timestamp', async () => {
      stub({
        method: 'findOne',
        docConfig: {
          slug: 'vip-rate-card',
          creator_reference: VALID_REF,
          status: 'published',
          access_type: 'private',
          access_code: 'A1B2C3',
        },
      });
      const res = await server.delete('/creator-cards/vip-rate-card', {
        body: { creator_reference: VALID_REF },
      });
      const card = res.data.data;

      expect(res.statusCode).to.equal(200);
      expect(res.data.message).to.equal('Creator Card Deleted Successfully.');
      expect(card).to.have.property('access_code', 'A1B2C3'); // included on delete (unlike GET)
      expect(card).to.not.have.property('_id');
      expect(card).to.have.property('id');
      expect(card.slug).to.equal('vip-rate-card'); // original slug, not the mangled one
      expect(card.deleted).to.be.a('number').and.greaterThan(0);
    });
  });

  describe('creator_reference validation', () => {
    it('rejects a creator_reference longer than 20 chars (400)', async () => {
      const res = await server.delete('/creator-cards/george-cooks', {
        body: { creator_reference: `${VALID_REF}_EXTRA` },
      });
      expect(res.statusCode).to.equal(400);
      expect(res.data.status).to.equal('error');
    });

    it('rejects an omitted creator_reference (400)', async () => {
      const res = await server.delete('/creator-cards/george-cooks', { body: {} });
      expect(res.statusCode).to.equal(400);
      expect(res.data.status).to.equal('error');
    });

    it('a 20-char creator_reference clears validation and reaches the lookup (NF01, not 400)', async () => {
      stub({ method: 'findOne', mockNull: true });
      const res = await server.delete('/creator-cards/george-cooks', {
        body: { creator_reference: VALID_REF },
      });
      expect(res.statusCode).to.equal(404);
      expect(res.data.code).to.equal('NF01');
    });
  });

  describe('anti-leak & sequencing', () => {
    it('T15: owner-mismatch NF01 is byte-identical to missing-card NF01', async () => {
      stub({
        method: 'findOne',
        docConfig: {
          slug: 'george-cooks',
          creator_reference: 'different-ref-here00',
          status: 'published',
        },
      });
      const mismatch = await server.delete('/creator-cards/george-cooks', {
        body: { creator_reference: VALID_REF },
      });
      revertStubs();

      stub({ method: 'findOne', mockNull: true });
      const missing = await server.delete('/creator-cards/does-not-exist', {
        body: { creator_reference: VALID_REF },
      });

      expect(mismatch.statusCode).to.equal(404);
      expect(missing.statusCode).to.equal(404);
      expect(mismatch.data).to.deep.equal(missing.data);
      expect(mismatch.data).to.deep.equal({
        status: 'error',
        message: 'Creator card not found',
        code: 'NF01',
      });
    });

    it('T16: after a successful DELETE, a GET of that slug returns NF01', async () => {
      stub({
        method: 'findOne',
        docConfig: { slug: 'george-cooks', creator_reference: VALID_REF, status: 'published' },
      });
      const del = await server.delete('/creator-cards/george-cooks', {
        body: { creator_reference: VALID_REF },
      });
      revertStubs();

      // The row is now soft-deleted: the paranoid findOne filter makes it invisible.
      stub({ method: 'findOne', mockNull: true });
      const get = await server.get('/creator-cards/george-cooks', {});

      expect(del.statusCode).to.equal(200);
      expect(get.statusCode).to.equal(404);
      expect(get.data.code).to.equal('NF01');
    });
  });
});
