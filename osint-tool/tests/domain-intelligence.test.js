const test = require('node:test');
const assert = require('node:assert/strict');
const WhoisCollector = require('../src/modules/whoisCollector');

const collector = new WhoisCollector({});

test('extracts a valid domain from email and rejects malformed input', () => {
  assert.equal(collector.extractDomainFromEmail('User@Example.COM'), 'example.com');
  assert.equal(collector.extractDomainFromEmail('bad@localhost'), null);
  assert.equal(collector.extractDomainFromEmail('missing-at.example.com'), null);
});

test('parses Google DoH TXT and MX answers into stable values', () => {
  const txt = collector.parseDnsAnswers([
    { name: 'example.com.', type: 16, TTL: 300, data: '"v=spf1 include:_spf.example.net -all"' }
  ], 'TXT');
  const mx = collector.parseDnsAnswers([
    { name: 'example.com.', type: 15, TTL: 300, data: '10 mail.example.com.' }
  ], 'MX');

  assert.deepEqual(txt, [{
    name: 'example.com',
    type: 'TXT',
    ttl: 300,
    value: 'v=spf1 include:_spf.example.net -all'
  }]);
  assert.equal(mx[0].value, '10 mail.example.com');
});

test('detects SPF and DMARC from collected DNS evidence', () => {
  const dns = collector.emptyDnsEvidence();
  dns.TXT = [{ value: 'v=spf1 mx -all' }];
  dns.DMARC = [{ value: 'v=DMARC1; p=reject' }];

  assert.equal(collector.hasDnsEvidence(dns), true);
  assert.equal(dns.TXT.some((record) => /^v=spf1\b/i.test(record.value)), true);
  assert.equal(dns.DMARC.some((record) => /^v=dmarc1\b/i.test(record.value)), true);
});

test('parses RDAP response without inventing unavailable registrant data', () => {
  const result = collector.parseRdapResponse('example.com', {
    ldhName: 'EXAMPLE.COM',
    handle: '2336799_DOMAIN_COM-VRSN',
    status: ['client delete prohibited'],
    nameservers: [{ ldhName: 'A.IANA-SERVERS.NET' }],
    events: [
      { eventAction: 'registration', eventDate: '1995-08-14T04:00:00Z' },
      { eventAction: 'expiration', eventDate: '2027-08-13T04:00:00Z' }
    ],
    entities: []
  });

  assert.equal(result.domainName, 'EXAMPLE.COM');
  assert.equal(result.registrantName, null);
  assert.equal(result.registrantEmail, null);
  assert.deepEqual(result.nameservers, ['A.IANA-SERVERS.NET']);
  assert.equal(result.additionalData.rdap.queryService, 'rdap.org');
});
