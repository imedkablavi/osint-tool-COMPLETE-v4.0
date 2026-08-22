class ToolRegistry {
  constructor(tools = {}) {
    this.tools = tools;
  }

  getStatus(context = {}) {
    return {
      publicProfiles: {
        available: true,
        mode: 'built_in',
        sources: ['GitHub REST API', 'GitLab Users API', 'Hacker News API', 'Public page probes']
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
      sherlock: this.externalStatus('Sherlock', this.tools.sherlock),
      maigret: this.externalStatus('Maigret', this.tools.maigret),
      imageExif: this.exifStatus(this.tools.imageAnalyzer),
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
