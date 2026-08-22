const BaseCollector = require('./baseCollector');

class WhoisCollector extends BaseCollector {
  constructor(db) {
    super('DomainIntelligenceCollector', db);
    this.rdapBaseUrl = 'https://rdap.org/domain';
    this.dohUrl = 'https://dns.google/resolve';
    this.ctUrl = 'https://crt.sh/';
  }

  async collect(personId, searchData) {
    const email = String(searchData?.email || '').trim();
    if (!email) {
      await this.log(personId, 'WARNING', 'Domain intelligence skipped: no email address was provided.');
      return [];
    }

    const domain = this.extractDomainFromEmail(email);
    if (!domain) {
      await this.log(personId, 'WARNING', 'Domain intelligence skipped: the email domain is invalid.');
      return [];
    }

    if (this.isConsumerMailboxDomain(domain)) {
      await this.log(personId, 'INFO', `Domain intelligence skipped for common consumer mailbox domain: ${domain}`);
      return [];
    }

    await this.log(personId, 'INFO', `Collecting live RDAP, DNS and certificate-transparency evidence for ${domain}.`);

    const [rdapResult, dnsResult, ctResult] = await Promise.allSettled([
      this.performRdapLookup(domain),
      this.collectDnsEvidence(domain),
      this.collectCertificateTransparency(domain)
    ]);

    const rdap = rdapResult.status === 'fulfilled' ? rdapResult.value : null;
    const dns = dnsResult.status === 'fulfilled' ? dnsResult.value : this.emptyDnsEvidence();
    const certificateNames = ctResult.status === 'fulfilled' ? ctResult.value : [];

    const sourceStatus = {
      rdap: rdapResult.status === 'fulfilled' ? (rdap ? 'ok' : 'not_found') : `error: ${rdapResult.reason?.message || 'unknown'}`,
      dns: dnsResult.status === 'fulfilled' ? 'ok' : `error: ${dnsResult.reason?.message || 'unknown'}`,
      certificateTransparency: ctResult.status === 'fulfilled' ? 'ok' : `error: ${ctResult.reason?.message || 'unknown'}`
    };

    if (!rdap && !this.hasDnsEvidence(dns) && certificateNames.length === 0) {
      await this.log(personId, 'WARNING', `No usable live domain evidence was returned for ${domain}.`);
      return [];
    }

    const baseData = rdap ? this.parseRdapResponse(domain, rdap) : this.emptyDomainData(domain);
    const domainData = {
      ...baseData,
      nameservers: this.unique([
        ...(baseData.nameservers || []),
        ...(dns.NS || []).map((record) => record.value)
      ]),
      additionalData: {
        ...(baseData.additionalData || {}),
        source: 'Live domain intelligence',
        sources: ['RDAP', 'Google Public DNS DoH', 'Certificate Transparency'],
        sourceStatus,
        dns,
        emailSecurity: {
          spf: dns.TXT.filter((record) => /^v=spf1\b/i.test(record.value)),
          dmarc: dns.DMARC,
          hasSpf: dns.TXT.some((record) => /^v=spf1\b/i.test(record.value)),
          hasDmarc: dns.DMARC.some((record) => /^v=dmarc1\b/i.test(record.value))
        },
        certificateNames,
        certificateNameCount: certificateNames.length,
        checkedAt: new Date().toISOString()
      }
    };

    const id = this.db.addDomain(personId, domainData);
    await this.log(
      personId,
      'SUCCESS',
      `Stored live domain evidence for ${domain}: ${this.countDnsRecords(dns)} DNS record(s), ${certificateNames.length} certificate name(s).`
    );

    return [{ ...domainData, id: Number(id) }];
  }

  extractDomainFromEmail(email) {
    const at = email.lastIndexOf('@');
    if (at <= 0 || at === email.length - 1) return null;
    const domain = email.slice(at + 1).trim().toLowerCase().replace(/\.$/, '');
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(domain)) {
      return null;
    }
    return domain;
  }

  isConsumerMailboxDomain(domain) {
    return new Set([
      'gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'live.com', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'aol.com',
      'gmx.com', 'gmx.net', 'mail.com', 'yandex.com'
    ]).has(domain.toLowerCase());
  }

  async performRdapLookup(domain) {
    const response = await this.makeRequest(`${this.rdapBaseUrl}/${encodeURIComponent(domain)}`, {
      headers: {
        Accept: 'application/rdap+json, application/json',
        'User-Agent': 'OSINT-Tool/4.1 (+https://github.com/imedkablavi/osint-tool-COMPLETE-v4.0)'
      },
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status === 200 || status === 404
    });

    return response.status === 200 ? response.data : null;
  }

  async collectDnsEvidence(domain) {
    const recordTypes = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CAA'];
    const entries = await Promise.all(recordTypes.map(async (type) => [type, await this.resolveDns(domain, type)]));
    const dns = Object.fromEntries(entries);
    dns.DMARC = await this.resolveDns(`_dmarc.${domain}`, 'TXT');
    return dns;
  }

  async resolveDns(name, type) {
    const response = await this.makeRequest(this.dohUrl, {
      timeout: 15000,
      params: { name, type, do: 1 },
      headers: {
        Accept: 'application/dns-json',
        'User-Agent': 'OSINT-Tool/4.1'
      },
      validateStatus: (status) => status === 200 || status === 429
    });

    if (response.status === 429) throw new Error('Google Public DNS rate limit reached');
    const payload = response.data || {};
    if (Number(payload.Status) !== 0 && Number(payload.Status) !== 3) {
      throw new Error(`DNS response status ${payload.Status}`);
    }

    return this.parseDnsAnswers(payload.Answer, type);
  }

  parseDnsAnswers(answers, type) {
    if (!Array.isArray(answers)) return [];
    return answers.map((answer) => ({
      name: String(answer.name || '').replace(/\.$/, ''),
      type,
      ttl: Number(answer.TTL) || 0,
      value: this.normalizeDnsValue(answer.data, type)
    })).filter((record) => Boolean(record.value));
  }

  normalizeDnsValue(rawValue, type) {
    const value = String(rawValue ?? '').trim();
    if (!value) return '';

    if (type === 'TXT') {
      return value
        .replace(/^"|"$/g, '')
        .replace(/"\s+"/g, '')
        .replace(/\\"/g, '"');
    }

    if (type === 'MX') {
      const match = value.match(/^(\d+)\s+(.+)$/);
      if (match) return `${match[1]} ${match[2].replace(/\.$/, '')}`;
    }

    return value.replace(/\.$/, '');
  }

  async collectCertificateTransparency(domain) {
    const response = await this.makeRequest(this.ctUrl, {
      timeout: 20000,
      params: { q: `%.${domain}`, output: 'json' },
      headers: {
        Accept: 'application/json,text/plain;q=0.9,*/*;q=0.1',
        'User-Agent': 'OSINT-Tool/4.1'
      },
      maxContentLength: 5 * 1024 * 1024,
      validateStatus: (status) => [200, 404, 502, 503, 504].includes(status)
    });

    if (response.status !== 200) return [];
    const rows = Array.isArray(response.data) ? response.data : [];
    const names = [];

    for (const row of rows) {
      const values = String(row.name_value || row.common_name || '').split(/\r?\n/);
      for (const rawName of values) {
        const name = rawName.trim().toLowerCase().replace(/^\*\./, '').replace(/\.$/, '');
        if (!name) continue;
        if (name === domain || name.endsWith(`.${domain}`)) names.push(name);
        if (names.length >= 500) break;
      }
      if (names.length >= 500) break;
    }

    return this.unique(names).slice(0, 200);
  }

  emptyDnsEvidence() {
    return { A: [], AAAA: [], MX: [], NS: [], TXT: [], CAA: [], DMARC: [] };
  }

  hasDnsEvidence(dns) {
    return Object.values(dns || {}).some((records) => Array.isArray(records) && records.length > 0);
  }

  countDnsRecords(dns) {
    return Object.values(dns || {}).reduce((sum, records) => sum + (Array.isArray(records) ? records.length : 0), 0);
  }

  unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  emptyDomainData(domain) {
    return {
      domainName: domain,
      registrar: null,
      registrantName: null,
      registrantEmail: null,
      creationDate: null,
      expirationDate: null,
      nameservers: [],
      additionalData: {}
    };
  }

  parseRdapResponse(domain, data) {
    const entities = Array.isArray(data.entities) ? data.entities : [];
    const registrar = entities.find((entity) => Array.isArray(entity.roles) && entity.roles.includes('registrar'));
    const registrant = entities.find((entity) => Array.isArray(entity.roles) && entity.roles.includes('registrant'));
    const events = Array.isArray(data.events) ? data.events : [];

    return {
      domainName: data.ldhName || domain,
      registrar: this.entityDisplayName(registrar),
      registrantName: this.entityDisplayName(registrant),
      registrantEmail: this.entityEmail(registrant),
      creationDate: this.eventDate(events, ['registration', 'registered']),
      expirationDate: this.eventDate(events, ['expiration', 'expiry']),
      nameservers: (Array.isArray(data.nameservers) ? data.nameservers : [])
        .map((ns) => ns.ldhName || ns.unicodeName)
        .filter(Boolean),
      additionalData: {
        source: 'RDAP',
        rdap: {
          queryService: 'rdap.org',
          handle: data.handle || null,
          status: Array.isArray(data.status) ? data.status : [],
          secureDNS: data.secureDNS || null,
          notices: Array.isArray(data.notices)
            ? data.notices.map((notice) => ({ title: notice.title || '', description: notice.description || [] }))
            : []
        }
      }
    };
  }

  eventDate(events, actions) {
    const normalized = actions.map((action) => action.toLowerCase());
    const event = events.find((item) => normalized.includes(String(item.eventAction || '').toLowerCase()));
    return event?.eventDate || null;
  }

  entityDisplayName(entity) {
    if (!entity) return null;
    return this.vcardValue(entity, 'fn') || this.vcardValue(entity, 'org') || entity.handle || null;
  }

  entityEmail(entity) {
    return entity ? this.vcardValue(entity, 'email') : null;
  }

  vcardValue(entity, propertyName) {
    const card = entity?.vcardArray;
    if (!Array.isArray(card) || !Array.isArray(card[1])) return null;
    const entry = card[1].find((item) => Array.isArray(item) && String(item[0]).toLowerCase() === propertyName);
    if (!entry) return null;
    const value = entry[3];
    if (Array.isArray(value)) return value.filter(Boolean).join(' ');
    return value ? String(value) : null;
  }
}

module.exports = WhoisCollector;
