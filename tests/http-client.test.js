'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertPublicHttpUrl, createHttpClient } = require('../src/services/httpClient');

test('rejects local, private and credential-bearing collector URLs', () => {
  for (const url of ['http://example.com/test', 'http://localhost/test', 'http://127.0.0.1/test', 'http://192.168.1.4/test', 'https://user:pass@example.com']) {
    assert.throws(() => assertPublicHttpUrl(url));
  }
  assert.equal(assertPublicHttpUrl('https://example.com/path').hostname, 'example.com');
});

test('retries transient GET failures and returns the successful response', async () => {
  let calls = 0;
  const transport = { get: async () => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error('temporary'), { response: { status: 503 } });
    return { status: 200, data: { ok: true } };
  } };
  const client = createHttpClient({ transport, retries: 1, timeout: 1000 });
  const response = await client.get('https://example.com/resource');
  assert.equal(calls, 2);
  assert.deepEqual(response.data, { ok: true });
});
