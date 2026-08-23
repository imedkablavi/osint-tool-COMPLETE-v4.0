const test = require('node:test');
const assert = require('node:assert/strict');
const SherlockCollector = require('../src/modules/sherlockCollector');
const MaigretCollector = require('../src/modules/maigretCollector');
const ToolRegistry = require('../src/utils/toolRegistry');

const sherlock = new SherlockCollector({});
const maigret = new MaigretCollector({});

test('Sherlock parser accepts only positive URL lines and deduplicates them', () => {
  const results = sherlock.parseOutput([
    '[+] GitHub: https://github.com/alice',
    '[-] Reddit: Not Found!',
    '[+] GitHub: https://github.com/alice',
    '[+] Medium: https://medium.com/@alice'
  ].join('\n'));
  assert.deepEqual(results, [
    { platform: 'GitHub', url: 'https://github.com/alice' },
    { platform: 'Medium', url: 'https://medium.com/@alice' }
  ]);
});

test('Maigret parser consumes the official simple JSON report structure', () => {
  const results = maigret.parseSimpleReport({
    GitLab: {
      url_user: 'https://gitlab.com/alice',
      http_status: 200,
      status: { tags: ['coding'], ids_data: { fullname: 'Alice Example', location: 'Istanbul' } }
    },
    HackerNews: { url_user: 'https://news.ycombinator.com/user?id=alice', status: { tags: [], ids_data: {} } }
  });
  assert.equal(results.length, 2);
  assert.equal(results[0].platform, 'GitLab');
  assert.equal(results[0].extracted.fullname, 'Alice Example');
  assert.equal(results[0].extractedCount, 2);
  assert.equal(results[1].url, 'https://news.ycombinator.com/user?id=alice');
});

test('external tool input validation blocks shell metacharacters', () => {
  assert.equal(sherlock.normalizeUsername('alice;rm -rf /'), '');
  assert.equal(maigret.normalizeUsername('alice && whoami'), '');
  assert.equal(sherlock.normalizeUsername('@alice_01'), 'alice_01');
});

test('ToolRegistry reports built-in, credential and optional tool readiness separately', () => {
  const registry = new ToolRegistry({
    sherlock: { isAvailable: () => true },
    maigret: { isAvailable: () => false },
    imageAnalyzer: { isExifToolAvailable: () => true }
  });

  const status = registry.getStatus({
    hasHibpApiKey: false,
    hasBraveApiKey: true,
    hasUrlscanApiKey: true,
    hasVirusTotalApiKey: false
  });
  assert.equal(status.publicProfiles.available, true);
  assert.equal(status.webSearch.available, true);
  assert.deepEqual(status.webSearch.sources, ['Brave Search API']);
  assert.equal(status.domainIntelligence.available, true);
  assert.equal(status.archiveIntelligence.available, true);
  assert.equal(status.ipRegistryIntelligence.available, true);
  assert.equal(status.urlscan.available, true);
  assert.equal(status.virusTotal.available, false);
  assert.equal(status.hibp.available, false);
  assert.equal(status.sherlock.available, true);
  assert.equal(status.maigret.available, false);
  assert.equal(status.localImageAnalysis.available, true);
  assert.equal(status.imageExif.available, true);
  assert.equal(status.reverseFaceSearch.available, false);
});

test('credential-backed provider readiness fails closed when secrets are absent', () => {
  const registry = new ToolRegistry({});
  const status = registry.getStatus({
    hasBraveApiKey: false,
    hasUrlscanApiKey: false,
    hasVirusTotalApiKey: false
  });
  assert.equal(status.webSearch.available, false);
  assert.equal(status.urlscan.available, false);
  assert.equal(status.virusTotal.available, false);
  assert.match(status.webSearch.reason, /not configured/i);
  assert.match(status.urlscan.reason, /not configured/i);
  assert.match(status.virusTotal.reason, /not configured/i);
});
