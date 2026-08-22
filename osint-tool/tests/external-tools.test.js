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

test('Maigret parser accepts positive URL lines and ignores noise', () => {
  const results = maigret.parseOutput([
    'Starting Maigret...',
    '[+] GitLab: https://gitlab.com/alice',
    '[-] Example: Not Found',
    '[+] HN: https://news.ycombinator.com/user?id=alice'
  ].join('\n'));

  assert.equal(results.length, 2);
  assert.equal(results[0].platform, 'GitLab');
  assert.equal(results[1].url, 'https://news.ycombinator.com/user?id=alice');
});

test('external tool input validation blocks shell metacharacters', () => {
  assert.equal(sherlock.normalizeUsername('alice;rm -rf /'), '');
  assert.equal(maigret.normalizeUsername('alice && whoami'), '');
  assert.equal(sherlock.normalizeUsername('@alice_01'), 'alice_01');
});

test('ToolRegistry reports built-in and optional tool readiness separately', () => {
  const registry = new ToolRegistry({
    sherlock: { isAvailable: () => true },
    maigret: { isAvailable: () => false },
    imageAnalyzer: { isExifToolAvailable: () => true }
  });

  const status = registry.getStatus({ hasHibpApiKey: false });
  assert.equal(status.publicProfiles.available, true);
  assert.equal(status.domainIntelligence.available, true);
  assert.equal(status.hibp.available, false);
  assert.equal(status.sherlock.available, true);
  assert.equal(status.maigret.available, false);
  assert.equal(status.imageExif.available, true);
  assert.equal(status.reverseFaceSearch.available, false);
});
