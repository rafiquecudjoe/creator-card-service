// Shared test harness for the Creator Card endpoints.
//
// Runs the real (mock-backed) Express server through @app-core/mock-server, so every
// test exercises the actual request lifecycle, response envelope, HTTP-status mapping
// and the error-`code` patch end to end. DB behaviour is driven by the template's
// model stubs (MockModelStubs.<Model>.configureStubs).
process.env.USE_MOCK_MODEL = process.env.USE_MOCK_MODEL || '1';

const createMockServer = require('@app-core/mock-server');
const { MockModelStubs } = require('@app/mock-models');

const server = createMockServer(['endpoints/creator-card']);
const cardStubs = MockModelStubs.CreatorCard;

// A valid 20-char creator_reference used across tests.
const VALID_REF = 'crt_8f2k1m9x4p7w3q5z';

// A minimal valid create payload (public, published).
function validCreatePayload(overrides = {}) {
  return {
    title: 'George Cooks',
    creator_reference: VALID_REF,
    status: 'published',
    ...overrides,
  };
}

// Active stub configurations for the current test; reverted via revertStubs() in afterEach.
const active = [];

/**
 * Configure a model-stub scenario for the current test.
 * @param {Object} options - { method, mockNull, mockDuplicateRecord, docConfig, overrideFn }
 */
function stub(options) {
  const handle = cardStubs.configureStubs(options);
  active.push(handle);
  return handle;
}

/** Revert all stub configurations applied during the current test. */
function revertStubs() {
  while (active.length) {
    active.pop().revert();
  }
}

module.exports = {
  server,
  cardStubs,
  stub,
  revertStubs,
  VALID_REF,
  validCreatePayload,
};
