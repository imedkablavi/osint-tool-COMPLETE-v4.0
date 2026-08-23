const BaseCollector = require('./baseCollector');

class VirusTotalCollector extends BaseCollector {
  constructor(db, apiKey = '') {
    super('VirusTotalCollector', db);
    this.apiKey = String(apiKey || '').trim();
    this.baseUrl = 'https://www.virustotal.com/api/v3/domains';
    this.maxDomains = 3;
  }

  setApiKey(apiKey = '') {
    this.apiKey = String(apiKey || '').trim();
  }

  async collect(personId, domains = []) {
    if (!this.apiKey) {
      await this.log(personId, 'WARNING', 'VirusTotal enrichment skipped: no API key is configured.');
      return [];
    }

    const targets = this.normalizeDomains(domains).slice(0, this.maxDomains);
    const collected = [];

    for (const domain of targets) {
      try {
        const payload = await this.lookupDomain(domain);
        if (!payload) continue;
        const mapped = this.mapDomain(domain, payload);
        if (!mapped || this.db.findSearchResultByUrl(personId, mapped.record.url)) continue;

        const id = this.db.addSearchResult(personId, mapped.record);
        this.recordEvidence(personId, {
          sourceName: 'VirusTotal API v3',
          sourceType: 'threat_intelligence_api',
          entityType: 'search_result',
          entityId: id,
          evidenceType: 'domain_reputation_report',
          sourceUrl: mapped.record.url,
          status: 'observed',
          qualityScore: 90,
          observedAt: new Date().toISOString(),
          metadata: mapped.metadata
        });
        collected.push({ id: Number(id), ...mapped.record });
      } catch (error) {
        await this.log(personId, 'WARNING', `VirusTotal lookup failed for ${domain}: ${error.message}`);
      }
    }

    await this.log(personId, 'SUCCESS', `VirusTotal stored ${collected.length} domain reputation record(s).`);
    return collected;
  }

  normalizeDomains(domains) {
    const values = Array.isArray(domains) ? domains : [domains];
    return [...new Set(values.map((value) => String(value || '').trim().toLowerCase().replace(/\.$/, '')))]
      .filter((domain) => /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(domain));
  }

  async lookupDomain(domain) {
    const response = await this.makeRequest(`${this.baseUrl}/${encodeURIComponent(domain)}`, {
      timeout: 20000,
      headers: {
        Accept: 'application/json',
        'x-apikey': this.apiKey,
        'User-Agent': 'OSINT-Tool/4.1 (+https://github.com/imedkablavi/osint-tool-COMPLETE-v4.0)'
      },
      validateStatus: (status) => [200, 400, 401, 403, 404, 429].includes(status)
    });

    if (response.status === 404) return null;
    if (response.status === 401 || response.status === 403) throw new Error('API key was rejected');
    if (response.status === 429) throw new Error('rate limit reached');
    if (response.status !== 200) throw new Error(`provider returned HTTP ${response.status}`);
    return response.data?.data || null;
  }

  mapDomain(domain, data = {}) {
    const attributes = data.attributes || {};
    const stats = attributes.last_analysis_stats || {};
    const normalizedStats = {
      harmless: Number(stats.harmless) || 0,
      malicious: Number(stats.malicious) || 0,
      suspicious: Number(stats.suspicious) || 0,
      undetected: Number(stats.undetected) || 0,
      timeout: Number(stats.timeout) || 0
    };
    const categories = attributes.categories && typeof attributes.categories === 'object'
      ? Object.values(attributes.categories).filter(Boolean).slice(0, 20)
      : [];
    const tags = Array.isArray(attributes.tags) ? attributes.tags.slice(0, 30) : [];
    const guiUrl = `https://www.virustotal.com/gui/domain/${encodeURIComponent(domain)}`;
    const riskParts = [
      `${normalizedStats.malicious} malicious`,
      `${normalizedStats.suspicious} suspicious`,
      `${normalizedStats.harmless} harmless`,
      `reputation ${Number(attributes.reputation) || 0}`
    ];

    return {
      record: {
        source: 'VirusTotal',
        title: `Domain reputation — ${domain}`,
        url: guiUrl,
        snippet: riskParts.join(' · '),
        dateFound: this.unixToIso(attributes.last_analysis_date || attributes.last_modification_date),
        relevanceScore: 0
      },
      metadata: {
        provider: 'VirusTotal API v3',
        domain,
        objectId: data.id || domain,
        objectType: data.type || 'domain',
        reputation: Number(attributes.reputation) || 0,
        lastAnalysisStats: normalizedStats,
        categories,
        tags,
        registrar: attributes.registrar || null,
        creationDate: this.unixToIso(attributes.creation_date),
        lastAnalysisDate: this.unixToIso(attributes.last_analysis_date),
        lastModificationDate: this.unixToIso(attributes.last_modification_date),
        whoisDate: this.unixToIso(attributes.whois_date),
        totalVotes: attributes.total_votes || null,
        caveat: 'VirusTotal reputation is third-party threat-intelligence context for the domain and is not evidence about the identity of an email user.'
      }
    };
  }

  unixToIso(value) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return new Date(seconds * 1000).toISOString();
  }
}

module.exports = VirusTotalCollector;
