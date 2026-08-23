const test = require('node:test');
const assert = require('node:assert/strict');
const HIBPCollector = require('../src/modules/hibpCollector');

function createDb() {
  const saved = [];
  return {
    saved,
    addLog: () => {},
    addBreach: (_personId, breachData) => {
      saved.push(breachData);
      return saved.length;
    }
  };
}

test('HIBP collector maps live-source response into schema-compatible breach data', async () => {
  const db = createDb();
  const collector = new HIBPCollector(db, 'test-key');
  collector.checkBreaches = async () => [{
    Name: 'ExampleBreach',
    BreachDate: '2024-02-03',
    Description: '<p>Example description</p>',
    DataClasses: ['Email addresses'],
    IsVerified: true
  }];

  const results = await collector.collect(1, { email: 'person@example.com' });

  assert.equal(results.length, 1);
  assert.equal(db.saved.length, 1);
  assert.deepEqual(db.saved[0], {
    email: 'person@example.com',
    breachName: 'ExampleBreach',
    breachDate: '2024-02-03',
    description: '<p>Example description</p>',
    dataClasses: ['Email addresses'],
    verified: true
  });
  assert.equal(results[0].source, 'Have I Been Pwned');
});

test('HIBP collector skips network work when no API key is configured', async () => {
  const db = createDb();
  const collector = new HIBPCollector(db, '');
  let called = false;
  collector.checkBreaches = async () => {
    called = true;
    return [];
  };

  const results = await collector.collect(1, { email: 'person@example.com' });
  assert.deepEqual(results, []);
  assert.equal(called, false);
});
