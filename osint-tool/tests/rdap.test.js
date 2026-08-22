const test = require('node:test');
const assert = require('node:assert/strict');
const WhoisCollector = require('../src/modules/whoisCollector');

const collector = new WhoisCollector(null);

test('extractDomainFromEmail normalizes valid domains', () => {
  assert.equal(collector.extractDomainFromEmail('Analyst@Example.COM'), 'example.com');
  assert.equal(collector.extractDomainFromEmail('not-an-email'), null);
});

test('consumer mailbox domains are skipped', () => {
  assert.equal(collector.isConsumerMailboxDomain('gmail.com'), true);
  assert.equal(collector.isConsumerMailboxDomain('example.org'), false);
});

test('RDAP response is normalized into database shape', () => {
  const parsed = collector.parseRdapResponse('example.com', {
    ldhName: 'EXAMPLE.COM',
    handle: '123',
    status: ['active'],
    events: [
      { eventAction: 'registration', eventDate: '2020-01-02T00:00:00Z' },
      { eventAction: 'expiration', eventDate: '2030-01-02T00:00:00Z' }
    ],
    nameservers: [{ ldhName: 'NS1.EXAMPLE.COM' }],
    entities: [
      {
        roles: ['registrar'],
        vcardArray: ['vcard', [['fn', {}, 'text', 'Example Registrar']]]
      }
    ]
  });

  assert.equal(parsed.domainName, 'EXAMPLE.COM');
  assert.equal(parsed.registrar, 'Example Registrar');
  assert.equal(parsed.creationDate, '2020-01-02T00:00:00Z');
  assert.equal(parsed.expirationDate, '2030-01-02T00:00:00Z');
  assert.deepEqual(parsed.nameservers, ['NS1.EXAMPLE.COM']);
  assert.equal(parsed.additionalData.source, 'RDAP');
});
