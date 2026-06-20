// OPTIONAL real-MongoDB integration tests.
//
// Skipped by default. They cover the true create -> get/delete round-trips and the
// exact created/updated/deleted semantics that the in-memory model stubs cannot model.
//
// Run them with a real database and WITHOUT the mock model:
//   cross-env RUN_INTEGRATION=1 MONGODB_URI="<your test db>" mocha \
//     --require dotenv/config test/creator-card/integration.test.js
// (point MONGODB_URI at a throwaway/test database — these tests write real documents.)

/* eslint-disable global-require */
// Requires inside the before() hook are intentionally lazy so this file has no
// side effects (and loads no real-DB dependencies) when the suite is skipped.
const { expect } = require('chai');

const ENABLED = Boolean(process.env.RUN_INTEGRATION && process.env.MONGODB_URI);
const REF_A = 'crt_8f2k1m9x4p7w3q5z';
const REF_B = 'crt_a1b2c3d4e5f6g7h8';

describe('Creator Card integration (real Mongo)', function integrationSuite() {
  this.timeout(20000);

  let server;
  let mongoose;
  let runId;

  before(async function maybeSkip() {
    if (!ENABLED) {
      this.skip();
      return;
    }
    // Real models require USE_MOCK_MODEL to be unset.
    if (parseInt(process.env.USE_MOCK_MODEL, 10)) {
      throw new Error('Integration tests require USE_MOCK_MODEL to be unset (real models).');
    }
    const { createConnection } = require('@app-core/mongoose');
    mongoose = require('mongoose');
    await createConnection({ uri: process.env.MONGODB_URI });
    const createMockServer = require('@app-core/mock-server');
    server = createMockServer(['endpoints/creator-card']);
    runId = `it${Date.now().toString(36)}`;
  });

  after(async () => {
    if (mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  });

  function payload(overrides = {}) {
    return {
      title: 'George Cooks',
      creator_reference: REF_A,
      status: 'published',
      ...overrides,
    };
  }

  it('create -> GET round-trip: created/updated persist; GET omits access_code', async () => {
    const slug = `${runId}-roundtrip`;
    const created = await server.post('/creator-cards', { body: payload({ slug }) });
    expect(created.statusCode).to.equal(200);
    expect(created.data.data.created).to.be.a('number').and.greaterThan(0);
    expect(created.data.data.created).to.equal(created.data.data.updated);
    expect(created.data.data).to.have.property('access_code');

    const got = await server.get(`/creator-cards/${slug}`, {});
    expect(got.statusCode).to.equal(200);
    expect(got.data.data).to.not.have.property('access_code');
    expect(got.data.data).to.have.property('id');
    expect(got.data.data.deleted).to.equal(null);
    expect(got.data.data.created).to.equal(created.data.data.created);
  });

  it('create -> DELETE: deleted goes from null to a Unix-ms timestamp', async () => {
    const slug = `${runId}-del`;
    const created = await server.post('/creator-cards', { body: payload({ slug }) });
    expect(created.data.data.deleted).to.equal(null);

    const deleted = await server.delete(`/creator-cards/${slug}`, {
      body: { creator_reference: REF_A },
    });
    expect(deleted.statusCode).to.equal(200);
    expect(deleted.data.data.deleted).to.be.a('number').and.greaterThan(0);
    expect(deleted.data.data.slug).to.equal(slug);
  });

  it('T16: create -> DELETE -> GET same slug -> 404 NF01', async () => {
    const slug = `${runId}-gone`;
    await server.post('/creator-cards', { body: payload({ slug }) });
    await server.delete(`/creator-cards/${slug}`, { body: { creator_reference: REF_A } });
    const got = await server.get(`/creator-cards/${slug}`, {});
    expect(got.statusCode).to.equal(404);
    expect(got.data.code).to.equal('NF01');
  });

  it('T7: two creates with the same client slug -> second is 400 SL02', async () => {
    const slug = `${runId}-dupe`;
    const first = await server.post('/creator-cards', { body: payload({ slug }) });
    expect(first.statusCode).to.equal(200);
    const second = await server.post('/creator-cards', {
      body: payload({ slug, creator_reference: REF_B }),
    });
    expect(second.statusCode).to.equal(400);
    expect(second.data.code).to.equal('SL02');
  });

  it('T2: auto-generated slugs stay unique across requests (second gets a suffix)', async () => {
    const title = `Ada Designs ${runId}`;
    const first = await server.post('/creator-cards', {
      body: { title, creator_reference: REF_A, status: 'published' },
    });
    const second = await server.post('/creator-cards', {
      body: { title, creator_reference: REF_B, status: 'published' },
    });
    expect(first.statusCode).to.equal(200);
    expect(second.statusCode).to.equal(200);
    expect(second.data.data.slug).to.not.equal(first.data.data.slug);
    expect(second.data.data.slug).to.match(new RegExp(`^${first.data.data.slug}-[a-z0-9]{6}$`));
  });
});
