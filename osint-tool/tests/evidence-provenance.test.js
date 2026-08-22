const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const DatabaseManager = require('../src/database/schema');
const { backfillEvidence } = require('../src/utils/evidenceRecorder');

function withDatabase(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'osint-db-test-'));
  const databasePath = path.join(directory, 'test.db');
  const db = new DatabaseManager(databasePath);
  try {
    return callback(db);
  } finally {
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('stores explicit source evidence with bounded quality and JSON metadata', () => {
  withDatabase((db) => {
    const personId = db.addPerson('Alice', null, 'alice');
    const accountId = db.addSocialAccount(personId, {
      platform: 'GitHub',
      username: 'alice',
      profileUrl: 'https://github.com/alice',
      confidenceScore: 95,
      additionalData: { source: 'GitHub REST API', sourceKind: 'official_public_api' }
    });

    db.addEvidence(personId, {
      sourceName: 'GitHub REST API',
      sourceType: 'official_public_api',
      entityType: 'social_account',
      entityId: accountId,
      evidenceType: 'exact_username_api_record',
      sourceUrl: 'https://github.com/alice',
      qualityScore: 150,
      metadata: { checkedAt: '2026-08-22T12:00:00Z' }
    });

    const evidence = db.getEvidence(personId);
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0].source_name, 'GitHub REST API');
    assert.equal(evidence[0].quality_score, 100);
    assert.deepEqual(JSON.parse(evidence[0].metadata), { checkedAt: '2026-08-22T12:00:00Z' });
  });
});

test('backfill creates one evidence record per existing social/domain entity and remains idempotent', () => {
  withDatabase((db) => {
    const personId = db.addPerson('Alice', 'alice@example.com', 'alice');
    db.addSocialAccount(personId, {
      platform: 'GitLab',
      username: 'alice',
      profileUrl: 'https://gitlab.com/alice',
      confidenceScore: 95,
      additionalData: {
        source: 'GitLab Users API',
        sourceKind: 'official_public_api',
        checkedAt: '2026-08-22T12:00:00Z'
      }
    });
    db.addDomain(personId, {
      domainName: 'example.com',
      nameservers: ['ns1.example.com'],
      additionalData: {
        source: 'Live domain intelligence',
        sourceStatus: { rdap: 'ok', dns: 'ok', certificateTransparency: 'ok' },
        checkedAt: '2026-08-22T12:00:30Z'
      }
    });

    assert.equal(backfillEvidence(db, personId), 2);
    assert.equal(backfillEvidence(db, personId), 0);

    const evidence = db.getEvidence(personId);
    assert.equal(evidence.length, 2);
    assert.ok(evidence.some((row) => row.entity_type === 'social_account'));
    assert.ok(evidence.some((row) => row.entity_type === 'domain'));
  });
});

test('deleting a case removes its source evidence', () => {
  withDatabase((db) => {
    const personId = db.addPerson('Alice', null, 'alice');
    db.addEvidence(personId, {
      sourceName: 'test',
      sourceType: 'test',
      entityType: 'case',
      evidenceType: 'test_observation',
      qualityScore: 50
    });

    assert.equal(db.getEvidence(personId).length, 1);
    const deleted = db.deletePerson(personId);
    assert.equal(deleted.changes, 1);
    assert.equal(db.getEvidence(personId).length, 0);
  });
});
