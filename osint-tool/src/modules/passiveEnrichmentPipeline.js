const WaybackCollector = require('./waybackCollector');
const UrlscanCollector = require('./urlscanCollector');
const VirusTotalCollector = require('./virusTotalCollector');
const IpRdapCollector = require('./ipRdapCollector');
const ShodanCollector = require('./shodanCollector');

class PassiveEnrichmentPipeline {
  constructor(db, settings = {}) {
    this.db = db;
    this.wayback = new WaybackCollector(db);
    this.urlscan = new UrlscanCollector(db, settings.urlscanApiKey || '');
    this.virusTotal = new VirusTotalCollector(db, settings.virusTotalApiKey || '');
    this.ipRdap = new IpRdapCollector(db);
    this.shodan = new ShodanCollector(db, settings.shodanApiKey || '');
  }

  setCredentials(settings = {}) {
    this.urlscan.setApiKey(settings.urlscanApiKey || '');
    this.virusTotal.setApiKey(settings.virusTotalApiKey || '');
    this.shodan.setApiKey(settings.shodanApiKey || '');
  }

  async collect(personId, targets = {}, options = {}) {
    const domains = Array.isArray(targets.domains) ? targets.domains : [];
    const ips = Array.isArray(targets.ips) ? targets.ips : [];
    const tasks = [
      ['wayback', this.wayback.collect(personId, domains)],
      ['ipRdap', this.ipRdap.collect(personId, ips)]
    ];

    if (options.hasUrlscanApiKey) tasks.push(['urlscan', this.urlscan.collect(personId, domains)]);
    if (options.hasVirusTotalApiKey) tasks.push(['virusTotal', this.virusTotal.collect(personId, domains)]);
    if (options.hasShodanApiKey) tasks.push(['shodan', this.shodan.collect(personId, ips)]);

    const settled = await Promise.allSettled(tasks.map(([, promise]) => promise));
    const results = [];
    const status = {};

    settled.forEach((entry, index) => {
      const name = tasks[index][0];
      if (entry.status === 'fulfilled') {
        const rows = Array.isArray(entry.value) ? entry.value : [];
        results.push(...rows);
        status[name] = { status: 'ok', count: rows.length };
      } else {
        status[name] = { status: 'error', count: 0, error: entry.reason?.message || 'unknown error' };
        try {
          this.db?.addLog(personId, 'PassiveEnrichmentPipeline', 'WARNING', `${name} failed: ${status[name].error}`);
        } catch {
          // Individual collectors already fail closed; logging here is best-effort.
        }
      }
    });

    if (!options.hasUrlscanApiKey) status.urlscan = { status: 'skipped', count: 0, reason: 'API key not configured' };
    if (!options.hasVirusTotalApiKey) status.virusTotal = { status: 'skipped', count: 0, reason: 'API key not configured' };
    if (!options.hasShodanApiKey) status.shodan = { status: 'skipped', count: 0, reason: 'API key not configured' };

    return { results, status };
  }
}

module.exports = PassiveEnrichmentPipeline;
