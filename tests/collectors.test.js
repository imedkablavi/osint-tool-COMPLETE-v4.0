'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const HIBPCollector = require('../src/modules/hibpCollector');
const WhoisCollector = require('../src/modules/whoisCollector');

function fakeDb() {
  return {
    breaches: [], domains: [], logs: [],
    addBreach(_id, value) { this.breaches.push(value); return this.breaches.length; },
    addDomain(_id, value) { this.domains.push(value); return this.domains.length; },
    addLog(_id, moduleName, status, message) { this.logs.push({ moduleName, status, message }); }
  };
}

test('HIBP skips account queries when no key is configured', async () => {
  const db = fakeDb();
  const http = { get: async () => { throw new Error('must not call'); } };
  const collector = new HIBPCollector(db, null, http);
  assert.deepEqual(await collector.collect(1, { email: 'alice@example.com' }), []);
  assert.equal(db.breaches.length, 0);
});

test('HIBP stores only provider responses using the database contract', async () => {
  const db = fakeDb();
  let calls = 0;
  const http = { get: async (url) => {
    calls += 1;
    return url.includes('/breachedaccount/')
      ? { status: 200, data: [{ Name: 'Example', BreachDate: '2024-01-02', DataClasses: ['Email addresses'], IsVerified: true }] }
      : { status: 404, data: [] };
  } };
  const collector = new HIBPCollector(db, 'test-placeholder', http);
  const results = await collector.collect(1, { email: 'alice@example.com' });
  assert.equal(calls, 2);
  assert.equal(results.length, 1);
  assert.equal(db.breaches[0].breachName, 'Example');
});

test('RDAP parses and stores a synthetic provider response', async () => {
  const db = fakeDb();
  const http = { get: async () => ({ status: 200, data: {
    objectClassName: 'domain',
    ldhName: 'example.org',
    events: [{ eventAction: 'registration', eventDate: '1995-08-14T00:00:00Z' }],
    nameservers: [{ ldhName: 'A.IANA-SERVERS.NET' }],
    status: ['active']
  } }) };
  const collector = new WhoisCollector(db, http);
  const results = await collector.collect(1, { email: 'alice@example.org' });
  assert.equal(results.length, 1);
  assert.equal(db.domains[0].domainName, 'example.org');
  assert.deepEqual(db.domains[0].nameservers, ['A.IANA-SERVERS.NET']);
});

test('HIBP preserves breach evidence when the paste endpoint fails', async () => {
  const db = fakeDb();
  const http = { get: async (url) => {
    if (url.includes('/pasteaccount/')) throw new Error('paste endpoint unavailable');
    return { status: 200, data: [{ Name: 'Example', BreachDate: '2024-01-02', DataClasses: ['Email addresses'], IsVerified: true }] };
  } };
  const collector = new HIBPCollector(db, 'test-placeholder', http);
  const results = await collector.collect(1, { email: 'alice@example.com' });
  assert.equal(results.length, 1);
  assert.equal(db.breaches[0].breachName, 'Example');
  assert.ok(db.logs.some((entry) => entry.status === 'ERROR' && entry.message.includes('paste endpoint failed')));
});

test('RDAP rejects malformed and mismatched success payloads', async () => {
  for (const data of [null, '<html>error</html>', { errorCode: 200 }, { objectClassName: 'domain', ldhName: 'other.example' }]) {
    const db = fakeDb();
    const collector = new WhoisCollector(db, { get: async () => ({ status: 200, data }) });
    assert.deepEqual(await collector.collect(1, { email: 'alice@example.org' }), []);
    assert.equal(db.domains.length, 0);
  }
});
