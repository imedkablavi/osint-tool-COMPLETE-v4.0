const HIBPCollector = require('./hibpCollector');

/**
 * Backwards-compatible breach collector.
 *
 * Older project code imports BreachCollector directly. Keep that API surface,
 * but delegate to the live HIBP implementation so this module never fabricates
 * breach records. Without an API key it returns no results and logs why.
 */
class BreachCollector extends HIBPCollector {
  constructor(db, apiKey = '') {
    super(db, apiKey);
    this.name = 'BreachCollector';
  }

  async checkHaveIBeenPwned(email, apiKey = this.apiKey) {
    const previousKey = this.apiKey;
    try {
      this.setApiKey(apiKey);
      if (!this.apiKey) throw new Error('Have I Been Pwned API key is required.');
      return await this.checkBreaches(email);
    } finally {
      this.setApiKey(previousKey);
    }
  }
}

module.exports = BreachCollector;
