'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const DatabaseManager = require('../src/database/schema');

test('database lifecycle stores, redacts and deletes an investigation', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'osint-casebook-test-'));
  const db = new DatabaseManager(path.join(directory, 'case.db'));
  t.after(() => {
    db.close();
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  const personId = db.addPerson('Alice', 'alice@example.com', 'alice');
  db.addLog(personId, 'Test', 'INFO', 'Queried alice@example.com token=supersecret');
  const log = db.getLogs(personId)[0];
  assert.doesNotMatch(log.message, /alice@example\.com|supersecret/);
  assert.equal(db.deletePerson(personId), 1);
  assert.equal(db.getPerson(personId), undefined);
  assert.deepEqual(db.getLogs(personId), []);
});
