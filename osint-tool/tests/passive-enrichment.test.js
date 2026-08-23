const test = require('node:test');
const assert = require('node:assert/strict');
const WaybackCollector = require('../src/modules/waybackCollector');
const UrlscanCollector = require('../src/modules/urlscanCollector');
const VirusTotalCollector = require('../src/modules/virusTotalCollector');
const IpRdapCollector = require('../src/modules/ipRdapCollector');
const ShodanCollector = require('../src/modules/shodanCollector');
const PassiveEnrichmentPipeline = require('../src/modules/passiveEnrichmentPipeline');

const fakeDb = {
  addLog() {},
  addSearchResult() { return 1; },
  addEvidence() { return 1; },
  findSearchResultByUrl() { return null; }
};

test('Wayback CDX parser maps bounded public captures', () => {
  const collector = new WaybackCollector(fakeDb);
  const rows = collector.parseCdx([
    ['timestamp', 'original', 'statuscode', 'mimetype', 'digest'],
    ['20260102030405', 'https://example.com/about', '200', 'text/html', 'ABC']
  ]);
  assert.equal(rows.length, 1);
  const mapped = collector.mapCapture('example.com', rows[0]);
  assert.equal(mapped.source, 'Wayback Machine');
  assert.equal(mapped.dateFound, '2026-01-02T03:04:05Z');
  assert.match(mapped.url, /^https:\/\/web\.archive\.org\/web\/20260102030405\//);
  assert.equal(collector.mapCapture('example.com', { timestamp: 'bad', original: 'javascript:alert(1)' }), null);
});

test('urlscan adapter is search-only and normalizes historical scan metadata', () => {
  const collector = new UrlscanCollector(fakeDb, 'key');
  assert.equal(collector.endpoint, 'https://urlscan.io/api/v1/search/');
  assert.doesNotMatch(collector.endpoint, /\/scan\/?$/);

  const raw = {
    _id: '1234',
    result: 'https://urlscan.io/result/1234/',
    task: { time: '2026-08-22T10:00:00Z', url: 'https://example.com/' },
    page: { domain: 'example.com', url: 'https://example.com/', ip: '93.184.216.34', country: 'US', asn: 'AS15133', asnname: 'EDGECAST' },
    verdicts: { overall: { malicious: false, score: 0 } },
    stats: { requests: 12 }
  };
  const mapped = collector.mapResult('example.com', raw);
  assert.equal(mapped.source, 'urlscan.io');
  assert.match(mapped.title, /Historical website scan/);
  const metadata = collector.metadataFromResult('example.com', raw);
  assert.equal(metadata.pageIp, '93.184.216.34');
  assert.equal(metadata.malicious, false);
  assert.equal(metadata.requests, 12);
});

test('VirusTotal domain mapper keeps reputation separate from identity semantics', () => {
  const collector = new VirusTotalCollector(fakeDb, 'key');
  const mapped = collector.mapDomain('example.com', {
    id: 'example.com',
    type: 'domain',
    attributes: {
      reputation: 7,
      last_analysis_date: 1780000000,
      last_analysis_stats: { harmless: 70, malicious: 2, suspicious: 1, undetected: 10 },
      categories: { vendorA: 'technology' },
      tags: ['known-tag']
    }
  });
  assert.equal(mapped.record.source, 'VirusTotal');
  assert.match(mapped.record.snippet, /2 malicious/);
  assert.equal(mapped.metadata.lastAnalysisStats.suspicious, 1);
  assert.equal(mapped.metadata.reputation, 7);
  assert.match(mapped.metadata.caveat, /not evidence about the identity/i);
});

test('IP RDAP enrichment accepts public addresses and rejects private/reserved ranges', () => {
  const collector = new IpRdapCollector(fakeDb);
  const publicIps = collector.normalizePublicIps([
    '8.8.8.8', '1.1.1.1', '198.51.101.10', '203.0.114.10',
    '10.0.0.1', '192.168.1.1', '169.254.1.1', '198.51.100.7', '203.0.113.7', '2001:db8::1', '::1'
  ]);
  assert.deepEqual(publicIps, ['8.8.8.8', '1.1.1.1', '198.51.101.10', '203.0.114.10']);

  const mapped = collector.mapIp('8.8.8.8', {
    name: 'GOOGLE', type: 'DIRECT ALLOCATION', country: 'US',
    startAddress: '8.8.8.0', endAddress: '8.8.8.255',
    cidr0_cidrs: [{ v4prefix: '8.8.8.0', length: 24 }]
  });
  assert.equal(mapped.metadata.country, 'US');
  assert.deepEqual(mapped.metadata.cidrs, ['8.8.8.0/24']);
});

test('Shodan mapper stores minified indexed host context without raw banners', () => {
  const collector = new ShodanCollector(fakeDb, 'key');
  const mapped = collector.mapHost('8.8.8.8', {
    last_update: '2026-08-20T10:00:00.000000',
    org: 'Google LLC',
    isp: 'Google LLC',
    asn: 'AS15169',
    country_code: 'US',
    country_name: 'United States',
    ports: [53, 443],
    hostnames: ['dns.google'],
    domains: ['google'],
    tags: ['dns'],
    vulns: { 'CVE-2025-0001': { verified: false } },
    data: [{ data: 'raw banner should not be mapped' }]
  });
  assert.equal(mapped.record.source, 'Shodan');
  assert.match(mapped.record.snippet, /ports: 53, 443/);
  assert.equal(mapped.metadata.minified, true);
  assert.deepEqual(mapped.metadata.ports, [53, 443]);
  assert.deepEqual(mapped.metadata.vulnerabilities, ['CVE-2025-0001']);
  assert.equal(Object.hasOwn(mapped.metadata, 'data'), false);
});

test('passive pipeline skips credential providers unless configured', async () => {
  const pipeline = new PassiveEnrichmentPipeline(fakeDb, {});
  pipeline.wayback.collect = async () => [{ source: 'Wayback Machine' }];
  pipeline.ipRdap.collect = async () => [{ source: 'IP RDAP' }];
  pipeline.urlscan.collect = async () => { throw new Error('should not run'); };
  pipeline.virusTotal.collect = async () => { throw new Error('should not run'); };
  pipeline.shodan.collect = async () => { throw new Error('should not run'); };

  const result = await pipeline.collect(1, { domains: ['example.com'], ips: ['8.8.8.8'] }, {
    hasUrlscanApiKey: false,
    hasVirusTotalApiKey: false,
    hasShodanApiKey: false
  });
  assert.equal(result.results.length, 2);
  assert.equal(result.status.urlscan.status, 'skipped');
  assert.equal(result.status.virusTotal.status, 'skipped');
  assert.equal(result.status.shodan.status, 'skipped');
});
