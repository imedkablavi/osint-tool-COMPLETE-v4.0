const BaseCollector = require('./baseCollector');

class UrlscanCollector extends BaseCollector {
  constructor(db, apiKey = '') {
    super('UrlscanCollector', db);
    this.apiKey = String(apiKey || '').trim();
    this.endpoint = 'https://urlscan.io/api/v1/search/';
    this.maxDomains = 3;
    this.maxResultsPerDomain = 12;
  }

  setApiKey(apiKey = '') {
    this.apiKey = String(apiKey || '').trim();
  }

  async collect(personId, domains = []) {
    if (!this.apiKey) {
      await this.log(personId, 'WARNING', 'urlscan enrichment skipped: no API key is configured.');
      return [];
    }

    const targets = this.normalizeDomains(domains).slice(0, this.maxDomains);
    const collected = [];

    for (const domain of targets) {
      try {
        const rows = await this.searchDomain(domain);
        for (const raw of rows) {
          const record = this.mapResult(domain, raw);
          if (!record || this.db.findSearchResultByUrl(personId, record.url)) continue;

          const id = this.db.addSearchResult(personId, record);
          const metadata = this.metadataFromResult(domain, raw);
          this.recordEvidence(personId, {
            sourceName: 'urlscan.io Search API',
            sourceType: 'website_scan_index_api',
            entityType: 'search_result',
            entityId: id,
            evidenceType: 'historical_website_scan',
            sourceUrl: record.url,
            status: 'observed',
            qualityScore: 88,
            observedAt: metadata.scanTime || new Date().toISOString(),
            metadata
          });
          collected.push({ id: Number(id), ...record });
        }
      } catch (error) {
        await this.log(personId, 'WARNING', `urlscan lookup failed for ${domain}: ${error.message}`);
      }
    }

    await this.log(personId, 'SUCCESS', `urlscan stored ${collected.length} historical scan record(s).`);
    return collected;
  }

  normalizeDomains(domains) {
    const values = Array.isArray(domains) ? domains : [domains];
    return [...new Set(values.map((value) => String(value || '').trim().toLowerCase().replace(/\.$/, '')))]
      .filter((domain) => /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(domain));
  }

  async searchDomain(domain) {
    const response = await this.makeRequest(this.endpoint, {
      timeout: 20000,
      params: { q: `page.domain:${domain}`, size: this.maxResultsPerDomain },
      headers: {
        Accept: 'application/json',
        'api-key': this.apiKey,
        'User-Agent': 'OSINT-Tool/4.1 (+https://github.com/imedkablavi/osint-tool-COMPLETE-v4.0)'
      },
      validateStatus: (status) => [200, 400, 401, 403, 429].includes(status)
    });

    if (response.status === 401 || response.status === 403) throw new Error('API key was rejected');
    if (response.status === 429) throw new Error('rate limit reached');
    if (response.status === 400) throw new Error('provider rejected the search query');
    return Array.isArray(response.data?.results) ? response.data.results.slice(0, this.maxResultsPerDomain) : [];
  }

  mapResult(domain, raw = {}) {
    const scanId = String(raw._id || raw.id || raw.task?.uuid || '').trim();
    let resultUrl = String(raw.result || '').trim();
    if (!resultUrl && scanId) resultUrl = `https://urlscan.io/result/${encodeURIComponent(scanId)}/`;

    try {
      const parsed = new URL(resultUrl);
      if (parsed.protocol !== 'https:' || !/(^|\.)urlscan\.io$/i.test(parsed.hostname)) return null;
      resultUrl = parsed.toString();
    } catch {
      return null;
    }

    const page = raw.page || {};
    const task = raw.task || {};
    const verdict = raw.verdicts?.overall || {};
    const pageUrl = String(page.url || task.url || '').trim();
    const network = [page.ip, page.country, page.asnname || page.asn].filter(Boolean).join(' · ');
    const verdictText = verdict.malicious === true ? 'flagged malicious' : verdict.malicious === false ? 'not flagged malicious' : 'verdict unavailable';

    return {
      source: 'urlscan.io',
      title: `Historical website scan — ${page.title || page.domain || domain}`,
      url: resultUrl,
      snippet: [pageUrl, network, verdictText].filter(Boolean).join(' · ').slice(0, 5000),
      dateFound: task.time || null,
      relevanceScore: 0
    };
  }

  metadataFromResult(domain, raw = {}) {
    const page = raw.page || {};
    const task = raw.task || {};
    const stats = raw.stats || {};
    const verdict = raw.verdicts?.overall || {};
    return {
      provider: 'urlscan.io Search API',
      queryDomain: domain,
      scanId: raw._id || raw.id || task.uuid || null,
      scanTime: task.time || null,
      taskUrl: task.url || null,
      visibility: task.visibility || null,
      pageUrl: page.url || null,
      pageDomain: page.domain || null,
      pageIp: page.ip || null,
      country: page.country || null,
      asn: page.asn || null,
      asnName: page.asnname || null,
      server: page.server || null,
      status: page.status || null,
      requests: Number(stats.requests) || null,
      malicious: typeof verdict.malicious === 'boolean' ? verdict.malicious : null,
      verdictScore: Number.isFinite(Number(verdict.score)) ? Number(verdict.score) : null,
      caveat: 'This is metadata from an existing urlscan.io scan. The application does not automatically submit new public scans.'
    };
  }
}

module.exports = UrlscanCollector;
