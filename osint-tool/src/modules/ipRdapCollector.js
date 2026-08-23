const net = require('net');
const BaseCollector = require('./baseCollector');

class IpRdapCollector extends BaseCollector {
  constructor(db) {
    super('IpRdapCollector', db);
    this.baseUrl = 'https://rdap.org/ip';
    this.maxIps = 8;
  }

  async collect(personId, ips = []) {
    const targets = this.normalizePublicIps(ips).slice(0, this.maxIps);
    if (!targets.length) return [];

    const collected = [];
    for (const ip of targets) {
      try {
        const payload = await this.lookupIp(ip);
        if (!payload) continue;
        const mapped = this.mapIp(ip, payload);
        if (!mapped || this.db.findSearchResultByUrl(personId, mapped.record.url)) continue;

        const id = this.db.addSearchResult(personId, mapped.record);
        this.recordEvidence(personId, {
          sourceName: 'IP RDAP',
          sourceType: 'network_registry_api',
          entityType: 'search_result',
          entityId: id,
          evidenceType: 'public_ip_registration_record',
          sourceUrl: mapped.record.url,
          status: 'observed',
          qualityScore: 95,
          observedAt: new Date().toISOString(),
          metadata: mapped.metadata
        });
        collected.push({ id: Number(id), ...mapped.record });
      } catch (error) {
        await this.log(personId, 'WARNING', `IP RDAP lookup failed for ${ip}: ${error.message}`);
      }
    }

    await this.log(personId, 'SUCCESS', `IP RDAP stored ${collected.length} public network record(s).`);
    return collected;
  }

  normalizePublicIps(ips) {
    const values = Array.isArray(ips) ? ips : [ips];
    const seen = new Set();
    return values.map((value) => String(value || '').trim())
      .filter((ip) => net.isIP(ip) > 0 && this.isPublicIp(ip))
      .filter((ip) => {
        const normalized = ip.toLowerCase();
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });
  }

  isPublicIp(ip) {
    const version = net.isIP(ip);
    if (version === 4) return this.isPublicIpv4(ip);
    if (version !== 6) return false;

    const lower = ip.toLowerCase();
    if (lower.startsWith('::ffff:')) {
      const mapped = lower.slice(7);
      if (net.isIP(mapped) === 4) return this.isPublicIpv4(mapped);
    }

    if (lower === '::' || lower === '::1') return false;
    if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return false; // fc00::/7
    if (/^fe[89ab][0-9a-f]:/i.test(lower)) return false; // fe80::/10
    if (/^ff/i.test(lower)) return false; // multicast
    if (/^2001:db8:/i.test(lower)) return false; // documentation
    return true;
  }

  isPublicIpv4(ip) {
    const octets = ip.split('.').map(Number);
    if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || b === 0)) return false;
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
    if (a === 203 && b === 0) return false;
    if (a >= 224) return false;
    return true;
  }

  async lookupIp(ip) {
    const response = await this.makeRequest(`${this.baseUrl}/${encodeURIComponent(ip)}`, {
      timeout: 20000,
      headers: {
        Accept: 'application/rdap+json, application/json',
        'User-Agent': 'OSINT-Tool/4.1 (+https://github.com/imedkablavi/osint-tool-COMPLETE-v4.0)'
      },
      validateStatus: (status) => [200, 404, 429].includes(status)
    });

    if (response.status === 404) return null;
    if (response.status === 429) throw new Error('rate limit reached');
    return response.data || null;
  }

  mapIp(ip, data = {}) {
    const registryUrl = `https://rdap.org/ip/${encodeURIComponent(ip)}`;
    const name = data.name || data.handle || 'Unlabeled network';
    const range = [data.startAddress, data.endAddress].filter(Boolean).join(' – ');
    const cidrs = Array.isArray(data.cidr0_cidrs)
      ? data.cidr0_cidrs.slice(0, 20).map((cidr) => `${cidr.v4prefix || cidr.v6prefix || ''}/${cidr.length ?? ''}`.replace(/^\//, ''))
      : [];

    return {
      record: {
        source: 'IP RDAP',
        title: `IP registration — ${ip} — ${name}`,
        url: registryUrl,
        snippet: [data.type, data.country, range].filter(Boolean).join(' · ') || 'Public IP registration record',
        dateFound: null,
        relevanceScore: 0
      },
      metadata: {
        provider: 'RDAP',
        ip,
        handle: data.handle || null,
        name: data.name || null,
        type: data.type || null,
        country: data.country || null,
        startAddress: data.startAddress || null,
        endAddress: data.endAddress || null,
        cidrs,
        port43: data.port43 || null,
        status: Array.isArray(data.status) ? data.status.slice(0, 20) : [],
        caveat: 'This record describes registration of a public IP observed in DNS. It does not prove the investigated person controls that address or network.'
      }
    };
  }
}

module.exports = IpRdapCollector;
