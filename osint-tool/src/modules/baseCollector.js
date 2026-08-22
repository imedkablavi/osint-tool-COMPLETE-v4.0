const axios = require('axios');

class BaseCollector {
  constructor(name, db) {
    this.name = name;
    this.db = db;
    this.timeout = 10000;
    this.retries = 3;
  }

  async log(personId, status, message) {
    if (this.db) {
      this.db.addLog(personId, this.name, status, message);
    }
    console.log(`[${this.name}] ${status}: ${message}`);
  }

  recordEvidence(personId, evidenceData) {
    if (!this.db || typeof this.db.addEvidence !== 'function') return null;
    return this.db.addEvidence(personId, evidenceData);
  }

  async makeRequest(url, options = {}) {
    const config = {
      timeout: this.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      ...options
    };

    for (let i = 0; i < this.retries; i++) {
      try {
        const response = await axios.get(url, config);
        return response;
      } catch (error) {
        if (i === this.retries - 1) {
          throw error;
        }
        await this.sleep(1000 * (i + 1));
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  calculateConfidence(factors) {
    let score = 0;
    let totalWeight = 0;

    for (const [factor, weight] of Object.entries(factors)) {
      if (factor) {
        score += weight;
      }
      totalWeight += weight;
    }

    return totalWeight > 0 ? (score / totalWeight) * 100 : 0;
  }

  async collect(personId, searchData) {
    throw new Error('collect() method must be implemented by subclass');
  }
}

module.exports = BaseCollector;
