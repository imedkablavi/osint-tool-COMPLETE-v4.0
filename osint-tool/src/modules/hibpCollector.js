const BaseCollector = require('./baseCollector');

class HIBPCollector extends BaseCollector {
  constructor(db, apiKey = '') {
    super('HIBPCollector', db);
    this.apiKey = apiKey;
    this.baseUrl = 'https://haveibeenpwned.com/api/v3';
    this.userAgent = 'OSINT-Tool/4.1 (+https://github.com/imedkablavi/osint-tool-COMPLETE-v4.0)';
  }

  setApiKey(apiKey = '') {
    this.apiKey = String(apiKey || '').trim();
  }

  async collect(personId, searchData) {
    const email = String(searchData?.email || '').trim();
    if (!email) {
      await this.log(personId, 'WARNING', 'HIBP check skipped: no email address was provided.');
      return [];
    }
    if (!this.apiKey) {
      await this.log(personId, 'WARNING', 'HIBP check skipped: no API key is configured.');
      return [];
    }

    await this.log(personId, 'INFO', 'Querying Have I Been Pwned for breach records.');

    const breaches = await this.checkBreaches(email);
    const results = [];

    for (const breach of breaches) {
      const breachData = {
        email,
        breachName: breach.Name || breach.Title || 'Unknown breach',
        breachDate: breach.BreachDate || null,
        description: breach.Description || null,
        dataClasses: Array.isArray(breach.DataClasses) ? breach.DataClasses : [],
        verified: Boolean(breach.IsVerified)
      };

      const id = this.db.addBreach(personId, breachData);
      const quality = breachData.verified ? 100 : 80;
      this.recordEvidence(personId, {
        sourceName: 'Have I Been Pwned',
        sourceType: 'external_api',
        entityType: 'breach',
        entityId: id,
        evidenceType: 'breached_account_record',
        sourceUrl: 'https://haveibeenpwned.com/',
        status: 'observed',
        qualityScore: quality,
        metadata: {
          breachName: breachData.breachName,
          domain: breach.Domain || null,
          title: breach.Title || null,
          pwnCount: Number.isFinite(Number(breach.PwnCount)) ? Number(breach.PwnCount) : null,
          verified: Boolean(breach.IsVerified),
          fabricated: Boolean(breach.IsFabricated),
          sensitive: Boolean(breach.IsSensitive),
          retired: Boolean(breach.IsRetired),
          spamList: Boolean(breach.IsSpamList),
          dataClasses: breachData.dataClasses,
          checkedAt: new Date().toISOString(),
          caveat: 'HIBP records indicate the queried email appears in the breach dataset; interpret the breach context separately.'
        }
      });

      results.push({
        id: Number(id),
        ...breachData,
        source: 'Have I Been Pwned',
        sourceUrl: 'https://haveibeenpwned.com/'
      });
    }

    await this.log(personId, 'SUCCESS', `HIBP check completed with ${results.length} breach record(s).`);
    return results;
  }

  async checkBreaches(email) {
    const response = await this.makeRequest(
      `${this.baseUrl}/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      {
        headers: {
          'hibp-api-key': this.apiKey,
          'User-Agent': this.userAgent
        },
        timeout: 30000,
        validateStatus: (status) => [200, 400, 401, 403, 404, 429].includes(status)
      }
    );

    if (response.status === 404) return [];
    if (response.status === 401) throw new Error('HIBP rejected the API key.');
    if (response.status === 403) throw new Error('HIBP rejected the request. Check the API plan and User-Agent policy.');
    if (response.status === 429) {
      const retryAfter = response.headers?.['retry-after'];
      throw new Error(`HIBP rate limit reached${retryAfter ? `; retry after ${retryAfter}s` : ''}.`);
    }
    if (response.status !== 200) throw new Error(`HIBP returned HTTP ${response.status}.`);

    return Array.isArray(response.data) ? response.data : [];
  }
}

module.exports = HIBPCollector;
