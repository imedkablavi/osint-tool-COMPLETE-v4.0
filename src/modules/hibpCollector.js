'use strict';

const BaseCollector = require('./baseCollector');

class HIBPCollector extends BaseCollector {
  constructor(db, apiKey = null, httpClient = null) {
    super('HIBPCollector', db, httpClient);
    this.apiKey = apiKey || null;
    this.baseUrl = 'https://haveibeenpwned.com/api/v3';
  }

  get configured() {
    return Boolean(this.apiKey);
  }

  headers() {
    if (!this.apiKey) throw new Error('HIBP is not configured');
    return {
      'hibp-api-key': this.apiKey,
      'User-Agent': 'OSINT-Casebook/1.1'
    };
  }

  async requestAccountEndpoint(path, email) {
    const response = await this.makeRequest(`${this.baseUrl}/${path}/${encodeURIComponent(email)}`, {
      headers: this.headers(),
      validateStatus: (status) => [200, 401, 403, 404, 429].includes(status)
    });
    if (response.status === 404) return [];
    if (response.status === 401 || response.status === 403) throw new Error('HIBP credentials were rejected');
    if (response.status === 429) throw new Error('HIBP rate limit reached');
    return Array.isArray(response.data) ? response.data : [];
  }

  checkBreaches(email) {
    return this.requestAccountEndpoint('breachedaccount', email);
  }

  checkPastes(email) {
    return this.requestAccountEndpoint('pasteaccount', email);
  }

  async collect(personId, searchData) {
    if (!searchData.email) return [];
    if (!this.configured) {
      await this.log(personId, 'INFO', 'HIBP skipped because no API key is configured');
      return [];
    }

    await this.log(personId, 'INFO', 'Querying HIBP for the configured investigation email');
    const [breachResult, pasteResult] = await Promise.allSettled([
      this.checkBreaches(searchData.email),
      this.checkPastes(searchData.email)
    ]);
    const results = [];
    const breaches = breachResult.status === 'fulfilled' ? breachResult.value : [];
    const pastes = pasteResult.status === 'fulfilled' ? pasteResult.value : [];

    for (const [label, result] of [['breach', breachResult], ['paste', pasteResult]]) {
      if (result.status === 'rejected') {
        await this.log(personId, 'ERROR', `HIBP ${label} endpoint failed: ${result.reason?.message || 'request failed'}`);
      }
    }

    try {

      for (const breach of breaches) {
        const record = {
          email: searchData.email,
          breachName: breach.Name || 'Unnamed breach',
          breachDate: breach.BreachDate || null,
          description: breach.Description || null,
          dataClasses: Array.isArray(breach.DataClasses) ? breach.DataClasses : [],
          verified: breach.IsVerified ? 1 : 0
        };
        const id = this.db.addBreach(personId, record);
        results.push({ ...record, id, type: 'breach' });
      }

      for (const paste of pastes) {
        const record = {
          email: searchData.email,
          breachName: `Paste: ${paste.Source || 'unknown source'}`,
          breachDate: paste.Date ? String(paste.Date).split('T')[0] : null,
          description: 'Email address appeared in a paste indexed by HIBP.',
          dataClasses: ['Email addresses', 'Paste record'],
          verified: 1
        };
        const id = this.db.addBreach(personId, record);
        results.push({ ...record, id, type: 'paste' });
      }

      await this.log(personId, 'SUCCESS', `Stored ${results.length} HIBP evidence record(s)`);
      return results;
    } catch (error) {
      await this.log(personId, 'ERROR', `HIBP response processing failed: ${error.message}`);
      return results;
    }
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey || null;
  }
}

module.exports = HIBPCollector;
