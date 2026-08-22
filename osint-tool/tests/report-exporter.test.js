const test = require('node:test');
const assert = require('node:assert/strict');
const { toPortableReport, toJson, toHtml } = require('../src/utils/reportExporter');

function sampleReport() {
  return {
    person: {
      id: 7,
      name: '<script>alert(1)</script> Analyst',
      email: 'analyst@example.com',
      username: 'analyst',
      created_at: '2026-08-22T12:00:00Z'
    },
    summary: {
      totalSocialAccounts: 1,
      totalBreaches: 1,
      totalDomains: 1,
      totalEvidenceRecords: 3,
      overallConfidence: 62.5,
      confidenceLevel: 'Medium',
      scoreMeaning: 'source_evidence_quality_not_identity_probability'
    },
    socialAccounts: [{
      id: 1,
      platform: 'GitHub',
      username: 'analyst',
      display_name: 'Analyst Example',
      profile_url: 'https://github.com/analyst',
      followers_count: 12,
      confidence_score: 95,
      additional_data: JSON.stringify({
        source: 'GitHub REST API',
        sourceKind: 'official_public_api',
        checkMethod: 'exact_username_api_record'
      })
    }],
    breaches: [{
      id: 2,
      email: 'analyst@example.com',
      breach_name: 'ExampleBreach',
      breach_date: '2024-01-01',
      description: '<p>Credential <strong>exposure</strong></p><script>bad()</script>',
      data_classes: JSON.stringify(['Email addresses', 'Passwords']),
      verified: 1
    }],
    domains: [{
      id: 3,
      domain_name: 'example.com',
      registrar: 'Example Registrar',
      creation_date: '2020-01-01T00:00:00Z',
      expiration_date: '2030-01-01T00:00:00Z',
      nameservers: JSON.stringify(['NS1.EXAMPLE.COM']),
      additional_data: JSON.stringify({
        source: 'Live domain intelligence',
        sourceStatus: { rdap: 'ok', dns: 'ok', certificateTransparency: 'ok' }
      })
    }],
    evidence: [{
      id: 20,
      source_name: 'GitHub REST API',
      source_type: 'official_public_api',
      entity_type: 'social_account',
      entity_id: 1,
      evidence_type: 'exact_username_api_record',
      source_url: 'https://github.com/analyst',
      status: 'observed',
      quality_score: 95,
      observed_at: '2026-08-22T12:00:30Z',
      metadata: JSON.stringify({ caveat: '<unsafe evidence note>' })
    }],
    provenance: {
      evidenceSchema: 1,
      recordsBackfilledThisRun: 0,
      note: 'Evidence quality is not identity probability.'
    },
    graph: { nodes: [], edges: [] },
    logs: [{ created_at: '2026-08-22T12:01:00Z', module_name: 'test', status: 'INFO', message: '<unsafe>' }]
  };
}

test('portable JSON export carries source provenance and normalized evidence', () => {
  const portable = toPortableReport(sampleReport(), { generatedAt: '2026-08-22T13:00:00Z' });
  assert.equal(portable.schemaVersion, '1.1');
  assert.equal(portable.generatedAt, '2026-08-22T13:00:00Z');
  assert.equal(portable.socialAccounts[0].evidence.source, 'GitHub REST API');
  assert.equal(portable.socialAccounts[0].followersCount, 12);
  assert.equal(portable.breaches[0].source, 'Have I Been Pwned');
  assert.equal(portable.domains[0].source, 'RDAP / DNS / Certificate Transparency');
  assert.equal(portable.evidence[0].sourceName, 'GitHub REST API');
  assert.equal(portable.evidence[0].qualityScore, 95);
  assert.equal(portable.summary.totalEvidenceRecords, 3);
  assert.equal(portable.summary.scoreMeaning, 'source_evidence_quality_not_identity_probability');
});

test('JSON export is valid and preserves the case evidence model', () => {
  const json = toJson(sampleReport(), { generatedAt: '2026-08-22T13:00:00Z' });
  const parsed = JSON.parse(json);
  assert.equal(parsed.case.id, 7);
  assert.equal(parsed.summary.overallConfidence, 62.5);
  assert.deepEqual(parsed.breaches[0].dataClasses, ['Email addresses', 'Passwords']);
  assert.equal(parsed.evidence.length, 1);
  assert.equal(parsed.provenance.evidenceSchema, 1);
});

test('HTML export escapes source-controlled fields and includes current source attribution', () => {
  const html = toHtml(sampleReport(), { generatedAt: '2026-08-22T13:00:00Z' });
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /<script>bad\(\)<\/script>/);
  assert.doesNotMatch(html, /<unsafe evidence note>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; Analyst/);
  assert.match(html, /Have I Been Pwned/);
  assert.match(html, /RDAP, Google Public DNS DoH/);
  assert.match(html, /Evidence provenance/);
  assert.match(html, /GitHub REST API/);
  assert.match(html, /Content-Security-Policy/);
});
