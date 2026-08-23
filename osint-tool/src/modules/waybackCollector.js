const BaseCollector = require('./baseCollector');

class WaybackCollector extends BaseCollector {
  constructor(db) {
    super('WaybackCollector', db);
    this.endpoint = 'https://web.archive.org/cdx/search/cdx';
    this.maxDomains = 3;
    this.maxCapturesPerDomain = 12;
  }

  async collect(personId, domains = []) {
    const targets = this.normalizeDomains(domains).slice(0, this.maxDomains);
    if (!targets.length) return [];

    const collected = [];
    for (const domain of targets) {
      try {
        const captures = await this.lookupDomain(domain);
        for (const capture of captures) {
          const record = this.mapCapture(domain, capture);
          if (!record || this.db.findSearchResultByUrl(personId, record.url)) continue;

          const id = this.db.addSearchResult(personId, record);
          this.recordEvidence(personId, {
            sourceName: 'Internet Archive Wayback Machine',
            sourceType: 'public_archive_api',
            entityType: 'search_result',
            entityId: id,
            evidenceType: 'archived_web_capture',
            sourceUrl: record.url,
            status: 'observed',
            qualityScore: 90,
            observedAt: new Date().toISOString(),
            metadata: {
              provider: 'Internet Archive Wayback Machine',
              domain,
              originalUrl: capture.original,
              captureTimestamp: capture.timestamp,
              httpStatus: capture.statuscode || null,
              mimeType: capture.mimetype || null,
              digest: capture.digest || null,
              caveat: 'An archive capture proves that the archived URL was indexed at the capture time; it does not prove ownership or identity.'
            }
          });
          collected.push({ id: Number(id), ...record });
        }
      } catch (error) {
        await this.log(personId, 'WARNING', `Wayback lookup failed for ${domain}: ${error.message}`);
      }
    }

    await this.log(personId, 'SUCCESS', `Wayback stored ${collected.length} archived capture record(s).`);
    return collected;
  }

  normalizeDomains(domains) {
    const values = Array.isArray(domains) ? domains : [domains];
    const seen = new Set();
    return values.map((value) => String(value || '').trim().toLowerCase().replace(/\.$/, ''))
      .filter((domain) => /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(domain))
      .filter((domain) => {
        if (seen.has(domain)) return false;
        seen.add(domain);
        return true;
      });
  }

  async lookupDomain(domain) {
    const response = await this.makeRequest(this.endpoint, {
      timeout: 20000,
      params: {
        url: `*.${domain}/*`,
        output: 'json',
        fl: 'timestamp,original,statuscode,mimetype,digest',
        filter: 'statuscode:200',
        collapse: 'digest',
        limit: this.maxCapturesPerDomain
      },
      headers: {
        Accept: 'application/json,text/plain;q=0.9',
        'User-Agent': 'OSINT-Tool/4.1 (+https://github.com/imedkablavi/osint-tool-COMPLETE-v4.0)'
      },
      validateStatus: (status) => [200, 403, 429].includes(status)
    });

    if (response.status === 403) throw new Error('archive access was denied');
    if (response.status === 429) throw new Error('archive rate limit reached');
    return this.parseCdx(response.data);
  }

  parseCdx(payload) {
    if (!Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[0])) return [];
    const headers = payload[0].map((value) => String(value));
    return payload.slice(1, this.maxCapturesPerDomain + 1).map((row) => {
      if (!Array.isArray(row)) return null;
      return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null]));
    }).filter(Boolean);
  }

  mapCapture(domain, capture = {}) {
    const timestamp = String(capture.timestamp || '').replace(/\D/g, '');
    if (!/^\d{14}$/.test(timestamp)) return null;

    let original;
    try {
      const parsed = new URL(String(capture.original || ''));
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;
      original = parsed.toString();
    } catch {
      return null;
    }

    const replayUrl = `https://web.archive.org/web/${timestamp}/${original}`;
    return {
      source: 'Wayback Machine',
      title: `Archived capture — ${domain}`,
      url: replayUrl,
      snippet: `${original} · capture ${timestamp} · HTTP ${capture.statuscode || 'unknown'} · ${capture.mimetype || 'unknown type'}`,
      dateFound: this.timestampToIso(timestamp),
      relevanceScore: 0
    };
  }

  timestampToIso(timestamp) {
    const match = String(timestamp).match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
    return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z` : null;
  }
}

module.exports = WaybackCollector;
