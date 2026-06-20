const { expect } = require('chai');
const generateSlug = require('../../services/creator-card/generate-slug');

const freeRepo = { findOne: async () => null }; // every slug available
// findOne returns "taken" exactly once, then available (exercises the suffix retry).
function takenOnce() {
  let n = 0;
  return {
    calls: 0,
    findOne: async function findOne() {
      this.calls += 1;
      n += 1;
      return n === 1 ? { _id: 'x' } : null;
    },
  };
}

describe('generateSlug (unit)', () => {
  it('T2: "Ada Designs Things" -> "ada-designs-things" when available', async () => {
    const slug = await generateSlug(freeRepo, 'Ada Designs Things');
    expect(slug).to.equal('ada-designs-things');
    expect(slug).to.match(/^[a-z0-9_-]+$/);
  });

  it('lowercases, hyphenates whitespace, and strips chars outside [a-z0-9_-]', async () => {
    const slug = await generateSlug(freeRepo, 'Hello World_2024! @ME');
    expect(slug).to.equal('hello-world_2024-me');
  });

  it('appends "-<6 alnum>" for a short base ("Cook", length 4 < 5)', async () => {
    const slug = await generateSlug(freeRepo, 'Cook');
    expect(slug).to.match(/^cook-[a-z0-9]{6}$/);
    expect(slug).to.have.lengthOf(11);
  });

  it('produces a 6-char alphanumeric slug for a symbols-only title (empty base)', async () => {
    const slug = await generateSlug(freeRepo, '!!!@@@');
    expect(slug).to.match(/^[a-z0-9]{6}$/);
    expect(slug).to.have.lengthOf(6);
  });

  it('retries with a suffix when the base slug is already taken', async () => {
    const repo = takenOnce();
    const slug = await generateSlug(repo, 'George Cooks');
    expect(slug).to.match(/^george-cooks-[a-z0-9]{6}$/);
    expect(slug).to.not.equal('george-cooks');
    expect(repo.calls).to.equal(2);
  });

  it('keeps a 50-char base at exactly 50 (boundary, no truncation)', async () => {
    const slug = await generateSlug(freeRepo, 'a'.repeat(50));
    expect(slug).to.equal('a'.repeat(50));
  });

  it('caps a 51-char base to 50 with no trailing separator', async () => {
    const slug = await generateSlug(freeRepo, 'a'.repeat(51));
    expect(slug).to.have.lengthOf(50);
    expect(slug).to.not.match(/[-_]$/);
  });

  it('strips a trailing hyphen left at the 50-char cut', async () => {
    const slug = await generateSlug(freeRepo, `${'a'.repeat(49)}-bbbbb`);
    expect(slug).to.equal('a'.repeat(49));
    expect(slug).to.not.match(/[-_]$/);
  });

  it('keeps a suffixed slug <= 50 for a long taken base', async () => {
    const repo = takenOnce();
    const slug = await generateSlug(repo, 'z'.repeat(80));
    expect(slug.length).to.be.at.most(50);
    expect(slug).to.match(/-[a-z0-9]{6}$/);
  });
});
