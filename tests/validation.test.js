'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePersonId, validatePersonInput, safeError } = require('../src/main/validation');

test('accepts a bounded authorized-investigation input', () => {
  assert.deepEqual(validatePersonInput({ name: 'Alice', email: 'alice@example.com', username: '' }), {
    name: 'Alice', email: 'alice@example.com', username: null
  });
});

test('rejects malformed inputs and identifiers', () => {
  assert.throws(() => validatePersonInput({ name: 'Only a name' }), /required/);
  assert.throws(() => validatePersonInput({ username: '<script>' }), /invalid/);
  assert.throws(() => validatePersonId('../1'), /Invalid/);
});

test('does not expose unexpected internal errors', () => {
  assert.equal(safeError(new Error('/home/user/secret.db failed')), 'The operation failed. See the redacted application log for details.');
});
