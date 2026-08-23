const BaseCollector = require('./baseCollector');

/**
 * Legacy compatibility wrapper.
 *
 * Holehe-style checks infer account existence through signup/password-recovery
 * behavior. They can be rate-limited, change without notice, and the old
 * integration treated some rate-limit responses as positive account evidence.
 * That is not acceptable for the commercial evidence pipeline.
 *
 * Keep this module import-compatible, but do not emit account records until a
 * provider-specific implementation can return auditable, policy-compatible
 * evidence without guessing from ambiguous responses.
 */
class HoleheCollector extends BaseCollector {
  constructor(db) {
    super('HoleheCollector', db);
  }

  async collect(personId) {
    await this.log(
      personId,
      'WARNING',
      'Holehe account-recovery enumeration is disabled in the evidence pipeline because its signals are not reliable enough for commercial reporting.'
    );
    return [];
  }
}

module.exports = HoleheCollector;
