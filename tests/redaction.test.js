'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { redact, redactString, redactUrl } = require('../src/security/redaction');

test('redacts secrets and masks email addresses', () => {
  const output = redactString('email alice@example.com Authorization: Bearer abc.def.ghi token=topsecret');
  assert.doesNotMatch(output, /alice@example\.com|abc\.def\.ghi|topsecret/);
  assert.match(output, /a\*\*\*e@example\.com/);
});

test('redacts nested secret fields without mutating input', () => {
  const input = { user: 'alice@example.com', headers: { authorization: 'Bearer secret' } };
  const output = redact(input);
  assert.equal(output.headers.authorization, '[REDACTED]');
  assert.equal(input.headers.authorization, 'Bearer secret');
});

test('redacts sensitive URL query values and credentials', () => {
  const output = redactUrl('https://user:pass@example.com/path?api_key=secret&ok=yes');
  assert.doesNotMatch(output, /user|pass|secret/);
  assert.match(output, /ok=yes/);
});
