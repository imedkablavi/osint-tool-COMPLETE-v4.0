const test = require('node:test');
const assert = require('node:assert/strict');
const BraveSearchCollector = require('../src/modules/braveSearchCollector');

function createDb() {
  const state = { results: [], evidence: [], logs: [] };
  return {
    state,
    getSearchResults: () => state.results,
    addSearchResult: (_personId, data) => {
      const row = { id: state.results.length + 1, ...data };
      state.results.push(row);
      return row.id;
    },
    addEvidence: (_personId, data) => {
      state.evidence.push(data);
      return state.evidence.length;
    },
    addLog: (_personId, moduleName, status, message) => state.logs.push({ moduleName, status, message })
  };
}

test('Brave query plan is bounded and balances available identifiers', () => {
  const collector = new BraveSearchCollector(createDb(), 'test-key');
  const plan = collector.buildQueryPlan({
    email: 'Alice@example.com',
    username: '@alice',
    name: 'Alice Example'
  });

  assert.equal(plan.length, 6);
  assert.deepEqual(plan.map((item) => item.category), [
    'email_exact',
    'email_documents',
    'username_exact',
    'username_url',
    'name_exact',
    'name_documents'
  ]);
  assert.ok(plan.every((item) => item.query.length <= 400));
});

test('Brave query inputs remove quote/backslash injection characters', () => {
  const collector = new BraveSearchCollector(createDb(), 'test-key');
  assert.equal(collector.cleanValue('alice" OR site:example.com \\ test', 120), 'alice OR site:example.com test');
});

test('Brave result mapping accepts only HTTP(S) URLs and strips provider markup', () => {
  const collector = new BraveSearchCollector(createDb(), 'test-key');
  const mapped = collector.mapResult({
    title: 'Alice <b>Profile</b>',
    url: 'https://example.com/alice#bio',
    description: '<strong>Alice</strong> public profile'
  }, { category: 'username_exact', query: '"alice"' }, 0);

  assert.equal(mapped.title, 'Alice Profile');
  assert.equal(mapped.url, 'https://example.com/alice');
  assert.equal(mapped.snippet, 'Alice public profile');
  assert.equal(collector.normalizeUrl('javascript:alert(1)'), '');
  assert.equal(collector.normalizeUrl('file:///tmp/x'), '');
});

test('Brave collection deduplicates URLs across queries and records provenance', async () => {
  const db = createDb();
  const collector = new BraveSearchCollector(db, 'test-key');
  collector.search = async () => ({
    web: {
      results: [{
        title: 'Alice',
        url: 'https://example.com/alice',
        description: 'Public result'
      }]
    }
  });

  const results = await collector.collect(7, { username: 'alice' });
  assert.equal(results.length, 1);
  assert.equal(db.state.results.length, 1);
  assert.equal(db.state.evidence.length, 1);
  assert.equal(db.state.evidence[0].sourceName, 'Brave Search API');
  assert.equal(db.state.evidence[0].entityType, 'search_result');
  assert.equal(db.state.evidence[0].metadata.caveat.includes('not proof'), true);
});

test('Brave collection performs no network work without a key', async () => {
  const db = createDb();
  const collector = new BraveSearchCollector(db, '');
  collector.search = async () => {
    throw new Error('network should not be called');
  };

  const results = await collector.collect(1, { username: 'alice' });
  assert.deepEqual(results, []);
  assert.equal(db.state.results.length, 0);
});
