class ToolRegistry {
  constructor(tools = {}, options = {}) {
    this.tools = tools;
    this.cacheTtlMs = Number(options.cacheTtlMs) > 0 ? Number(options.cacheTtlMs) : 30000;
    this.cache = new Map();
  }

  getStatus(context = {}, options = {}) {
    if (options.refresh === true) this.cache.clear();

    return {
      publicProfiles: {
        available: true,
        mode: 'built_in',
        sources: ['GitHub REST API', 'GitLab Users API', 'Hacker News API', 'Public page probes']
      },
      webSearch: {
        available: Boolean(context.hasBraveApiKey),
        mode: 'credential_required',
        sources: ['Brave Search API'],
        reason: context.hasBraveApiKey ? null : 'Brave Search API key is not configured.'
      },
      domainIntelligence: {
        available: true,
        mode: 'built_in',
        sources: ['RDAP', 'Google Public DNS DoH', 'Certificate Transparency']
      },
      hibp: {
        available: Boolean(context.hasHibpApiKey),
        mode: 'credential_required',
        reason: context.hasHibpApiKey ? null : 'HIBP API key is not configured.'
      },
      sherlock: this.cachedStatus('sherlock', () => this.externalStatus('Sherlock', this.tools.sherlock)),
      maigret: this.cachedStatus('maigret', () => this.externalStatus('Maigret', this.tools.maigret)),
      imageExif: this.cachedStatus('imageExif', () => this.exifStatus(this.tools.imageAnalyzer)),
      localImageAnalysis: {
        available: true,
        mode: 'built_in_local',
        reason: null
      },
      reverseFaceSearch: {
        available: false,
        mode: 'disabled',
        reason: 'No audited live provider adapter is configured; fabricated matches are prohibited.'
      },
      accountRecoveryEnumeration: {
        available: false,
        mode: 'disabled',
        reason: 'Ambiguous password-recovery signals are excluded from the evidence pipeline.'
      }
    };
  }

  cachedStatus(key, resolver) {
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && now - cached.checkedAt < this.cacheTtlMs) return cached.value;

    const value = resolver();
    this.cache.set(key, { checkedAt: now, value });
    return value;
  }

  externalStatus(name, tool) {
    let available = false;
    try {
      available = Boolean(tool && typeof tool.isAvailable === 'function' && tool.isAvailable());
    } catch {
      available = false;
    }

    return {
      available,
      mode: 'local_executable',
      reason: available ? null : `${name} is not installed or not available in PATH.`
    };
  }

  exifStatus(tool) {
    let available = false;
    try {
      available = Boolean(tool && typeof tool.isExifToolAvailable === 'function' && tool.isExifToolAvailable());
    } catch {
      available = false;
    }

    return {
      available,
      mode: 'local_executable',
      reason: available ? null : 'ExifTool is not installed or not available in PATH.'
    };
  }
}

module.exports = ToolRegistry;
