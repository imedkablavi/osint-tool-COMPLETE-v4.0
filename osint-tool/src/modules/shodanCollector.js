const net = require('net');
const BaseCollector = require('./baseCollector');

class ShodanCollector extends BaseCollector {
  constructor(db, apiKey = '') {
    super('ShodanCollector', db);
    this.apiKey = String(apiKey || '').trim();
    this.baseUrl = 'https://api.shodan.io/shodan/host';
    this.maxIps = 8;
  }

  setApiKey(apiKey = '') {
    this.apiKey = String(apiKey || '').trim();
  }

  async collect(personId, ips = []) {
    if (!this.apiKey) {
      await this.log(personId, 'WARNING', 'Shodan enrichment skipped: no API key is configured.');
      return [];
    }

    const targets = [...new Set((Array.isArray(ips) ? ips : [ips]).map((value) => String(value || '').trim()))]
      .filter((ip) => net.isIP(ip) > 0)
      .slice(0, this.maxIps);
    const collected = [];

    for (const ip of targets) {
      try {
        const payload = await this.lookupHost(ip);
        if (!payload) continue;
        const mapped = this.mapHost(ip, payload);
        if (this.db.findSearchResultByUrl(personId, mapped.record.url)) continue;

        const id = this.db.addSearchResult(personId, mapped.record);
        this.recordEvidence(personId, {
          sourceName: 'Shodan API',
          sourceType: 'internet_device_index_api',
          entityType: 'search_result',
          entityId: id,
          evidenceType: 'indexed_host_service_record',
          sourceUrl: mapped.record.url,
          status: 'observed',
          qualityScore: 88,
          observedAt: mapped.metadata.lastUpdate || new Date().toISOString(),
          metadata: mapped.metadata
        });
        collected.push({ id: Number(id), ...mapped.record });
      } catch (error) {
        await this.log(personId, 'WARNING', `Shodan lookup failed for ${ip}: ${error.message}`);
      }
    }

    await this.log(personId, 'SUCCESS', `Shodan stored ${collected.length} indexed host record(s).`);
    return collected;
  }

  async lookupHost(ip) {
    const response = await this.makeRequest(`${this.baseUrl}/${encodeURIComponent(ip)}`, {
      timeout: 20000,
      params: { key: this.apiKey, minify: true },
      headers: {
        Accept: 'application/json',
        'User-Agent': 'OSINT-Tool/4.1 (+https://github.com/imedkablavi/osint-tool-COMPLETE-v4.0)'
      },
      validateStatus: (status) => [200, 400, 401, 403, 404, 429].includes(status)
    });

    if (response.status === 404) return null;
    if (response.status === 401 || response.status === 403) throw new Error('API key was rejected');
    if (response.status === 429) throw new Error('rate limit reached');
    if (response.status !== 200) throw new Error(response.data?.error || `provider returned HTTP ${response.status}`);
    return response.data || null;
  }

  mapHost(ip, data = {}) {
    const ports = Array.isArray(data.ports) ? data.ports.map(Number).filter(Number.isFinite).slice(0, 100) : [];
    const hostnames = Array.isArray(data.hostnames) ? data.hostnames.filter(Boolean).slice(0, 30) : [];
    const domains = Array.isArray(data.domains) ? data.domains.filter(Boolean).slice(0, 30) : [];
    const tags = Array.isArray(data.tags) ? data.tags.filter(Boolean).slice(0, 30) : [];
    const vulns = data.vulns && typeof data.vulns === 'object'
      ? (Array.isArray(data.vulns) ? data.vulns : Object.keys(data.vulns)).slice(0, 100)
      : [];
    const guiUrl = `https://www.shodan.io/host/${encodeURIComponent(ip)}`;

    return {
      record: {
        source: 'Shodan',
        title: `Indexed host — ${ip}${data.org ? ` — ${data.org}` : ''}`,
        url: guiUrl,
        snippet: [
          ports.length ? `ports: ${ports.join(', ')}` : null,
          data.asn || null,
          data.country_name || data.country_code || null,
          hostnames[0] || null
        ].filter(Boolean).join(' · ').slice(0, 5000),
        dateFound: data.last_update || null,
        relevanceScore: 0
      },
      metadata: {
        provider: 'Shodan API',
        ip,
        lastUpdate: data.last_update || null,
        org: data.org || null,
        isp: data.isp || null,
        asn: data.asn || null,
        os: data.os || null,
        countryCode: data.country_code || null,
        countryName: data.country_name || null,
        regionCode: data.region_code || null,
        city: data.city || null,
        latitude: Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : null,
        longitude: Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : null,
        ports,
        hostnames,
        domains,
        tags,
        vulnerabilities: vulns,
        minified: true,
        caveat: 'Shodan data is an existing third-party internet index snapshot. It does not prove current exposure, ownership, or control by the investigated person.'
      }
    };
  }
}

module.exports = ShodanCollector;
