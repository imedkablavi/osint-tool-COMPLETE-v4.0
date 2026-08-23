'use strict';

const { domainToASCII } = require('node:url');
const BaseCollector = require('./baseCollector');

const COMMON_MAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'proton.me', 'protonmail.com', 'aol.com', 'live.com'
]);

class WhoisCollector extends BaseCollector {
  constructor(db, httpClient = null) {
    super('RdapCollector', db, httpClient);
  }

  extractDomainFromEmail(email) {
    if (typeof email !== 'string') return null;
    const parts = email.trim().split('@');
    if (parts.length !== 2) return null;
    const domain = domainToASCII(parts[1].toLowerCase());
    return /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(domain) && domain.includes('.') ? domain : null;
  }

  parseRdapResponse(domain, data) {
    const events = new Map((data.events || []).map((event) => [event.eventAction, event.eventDate]));
    const registrar = (data.entities || []).find((entity) => entity.roles?.includes('registrar'));
    const registrarName = registrar?.vcardArray?.[1]?.find((item) => item[0] === 'fn')?.[3] || null;
    const nameservers = (data.nameservers || []).map((item) => item.ldhName).filter(Boolean);

    return {
      domainName: data.ldhName || domain,
      registrar: registrarName,
      registrantName: null,
      registrantEmail: null,
      creationDate: events.get('registration') || null,
      expirationDate: events.get('expiration') || null,
      nameservers,
      additionalData: {
        source: 'RDAP',
        handle: data.handle || null,
        status: data.status || [],
        secureDns: data.secureDNS?.delegationSigned ?? null
      }
    };
  }

  isValidRdapResponse(domain, data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (data.objectClassName !== 'domain' || typeof data.ldhName !== 'string') return false;
    return data.ldhName.replace(/\.$/, '').toLowerCase() === domain.toLowerCase();
  }

  async collect(personId, searchData) {
    const domain = searchData.domain || this.extractDomainFromEmail(searchData.email);
    if (!domain) {
      await this.log(personId, 'WARNING', 'No valid domain was provided');
      return [];
    }
    if (COMMON_MAIL_DOMAINS.has(domain)) {
      await this.log(personId, 'INFO', 'Public mail-provider domain skipped');
      return [];
    }

    await this.log(personId, 'INFO', 'Querying RDAP for one domain');
    try {
      const response = await this.makeRequest(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
        validateStatus: (status) => status === 200 || status === 404
      });
      if (response.status === 404) {
        await this.log(personId, 'INFO', 'RDAP returned no domain record');
        return [];
      }
      if (!this.isValidRdapResponse(domain, response.data)) {
        await this.log(personId, 'WARNING', 'RDAP returned an invalid or mismatched payload; no record was stored');
        return [];
      }
      const result = this.parseRdapResponse(domain, response.data);
      const id = this.db.addDomain(personId, result);
      await this.log(personId, 'SUCCESS', 'Stored one evidence-backed RDAP record');
      return [{ ...result, id }];
    } catch (error) {
      await this.log(personId, 'ERROR', 'RDAP request failed; no record was stored');
      return [];
    }
  }
}

module.exports = WhoisCollector;
