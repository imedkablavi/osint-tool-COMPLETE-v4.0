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
      overallConfidence: 62.5,
      confidenceLevel: 'Medium'
    },
    socialAccounts: [{
      id: 1,
      platform: 'GitHub',
      username: 'analyst',
      profile_url: 'https://github.com/analyst',
      confidence_score: 60,
      additional_data: JSON.stringify({ checkMethod: 'status_url_title_evidence' })
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
      additional_data: JSON.stringify({ source: 'RDAP' })
    }],
    graph: { nodes: [], edges: [] },
    logs: [{ created_at: '2026-08-22T12:01:00Z', module_name: 'test', status: 'INFO', message: '<unsafe>' }]
  };
}

test('portable JSON export carries source provenance and normalized evidence', () => {
  const portable = toPortableReport(sampleReport(), { generatedAt: '2026-08-22T13:00:00Z' });
  assert.equal(portable.schemaVersion, '1.0');
  assert.equal(portable.generatedAt, '2026-08-22T13:00:00Z');
  assert.equal(portable.socialAccounts[0].evidence.checkMethod, 'status_url_title_evidence');
  assert.equal(portable.breaches[0].source, 'Have I Been Pwned');
  assert.equal(portable.domains[0].source, 'RDAP');
  assert.match(portable.sourceNotes.socialProfiles, /manual identity verification/i);
});

test('JSON export is valid and preserves the case model', () => {
  const json = toJson(sampleReport(), { generatedAt: '2026-08-22T13:00:00Z' });
  const parsed = JSON.parse(json);
  assert.equal(parsed.case.id, 7);
  assert.equal(parsed.summary.overallConfidence, 62.5);
  assert.deepEqual(parsed.breaches[0].dataClasses, ['Email addresses', 'Passwords']);
});

test('HTML export escapes source-controlled fields and includes attribution', () => {
  const html = toHtml(sampleReport(), { generatedAt: '2026-08-22T13:00:00Z' });
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /<script>bad\(\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; Analyst/);
  assert.match(html, /Have I Been Pwned/);
  assert.match(html, /Source: RDAP/);
  assert.match(html, /Content-Security-Policy/);
});
