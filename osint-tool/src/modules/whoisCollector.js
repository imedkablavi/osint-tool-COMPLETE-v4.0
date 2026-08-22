const BaseCollector = require('./baseCollector');

class WhoisCollector extends BaseCollector {
  constructor(db) {
    super('RDAPCollector', db);
    this.rdapBaseUrl = 'https://rdap.org/domain';
  }

  async collect(personId, searchData) {
    const email = String(searchData?.email || '').trim();
    if (!email) {
      await this.log(personId, 'WARNING', 'RDAP check skipped: no email address was provided.');
      return [];
    }

    const domain = this.extractDomainFromEmail(email);
    if (!domain) {
      await this.log(personId, 'WARNING', 'RDAP check skipped: the email domain is invalid.');
      return [];
    }

    if (this.isConsumerMailboxDomain(domain)) {
      await this.log(personId, 'INFO', `RDAP check skipped for common consumer mailbox domain: ${domain}`);
      return [];
    }

    await this.log(personId, 'INFO', `Querying RDAP for ${domain}.`);

    try {
      const rdap = await this.performRdapLookup(domain);
      if (!rdap) {
        await this.log(personId, 'INFO', `No RDAP registration record found for ${domain}.`);
        return [];
      }

      const domainData = this.parseRdapResponse(domain, rdap);
      const id = this.db.addDomain(personId, domainData);
      await this.log(personId, 'SUCCESS', `RDAP registration record stored for ${domain}.`);
      return [{ ...domainData, id: Number(id) }];
    } catch (error) {
      await this.log(personId, 'ERROR', `RDAP lookup failed: ${error.message}`);
      return [];
    }
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
        queryService: 'rdap.org',
        handle: data.handle || null,
        status: Array.isArray(data.status) ? data.status : [],
        secureDNS: data.secureDNS || null,
        notices: Array.isArray(data.notices)
          ? data.notices.map((notice) => ({ title: notice.title || '', description: notice.description || [] }))
          : []
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
