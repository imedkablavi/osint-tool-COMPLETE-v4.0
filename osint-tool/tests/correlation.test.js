const test = require('node:test');
const assert = require('node:assert/strict');
const CorrelationEngine = require('../src/utils/correlationEngine');

function createDb(overrides = {}) {
  return {
    getPerson: () => ({ id: 1, name: 'Test Case', email: 'case@example.org', username: 'caseuser' }),
    getSocialAccounts: () => [],
    getBreaches: () => [],
    getDomains: () => [],
    getLogs: () => [],
    ...overrides
  };
}

test('identical usernames produce maximum username similarity', () => {
  const engine = new CorrelationEngine(createDb());
  const result = engine.calculateSimilarity({ username: 'caseuser' }, { username: 'caseuser' });
  assert.equal(result.similarity, 100);
});

test('empty case report stays deterministic and finite', () => {
  const engine = new CorrelationEngine(createDb());
  const report = engine.generateReport(1);
  assert.equal(report.summary.totalSocialAccounts, 0);
  assert.equal(report.summary.totalBreaches, 0);
  assert.equal(report.summary.totalDomains, 0);
  assert.equal(report.summary.overallConfidence, 0);
  assert.equal(report.graph.nodes.length, 1);
});

test('graph links collected entities to the case subject', () => {
  const engine = new CorrelationEngine(createDb({
    getSocialAccounts: () => [{ id: 9, platform: 'GitHub', username: 'caseuser', confidence_score: 55 }]
  }));
  const graph = engine.buildRelationshipGraph(1);
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].from, 'person_1');
  assert.equal(graph.edges[0].to, 'social_9');
});
