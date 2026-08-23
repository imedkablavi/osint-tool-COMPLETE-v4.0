'use strict';

const BaseCollector = require('./baseCollector');

const PLATFORMS = Object.freeze([
  { name: 'GitHub', url: 'https://github.com/{username}', icon: '🐙' },
  { name: 'X / Twitter', url: 'https://x.com/{username}', icon: '𝕏' },
  { name: 'Instagram', url: 'https://instagram.com/{username}', icon: '📷' },
  { name: 'Facebook', url: 'https://facebook.com/{username}', icon: '👤' },
  { name: 'LinkedIn', url: 'https://linkedin.com/in/{username}', icon: '💼' },
  { name: 'Reddit', url: 'https://reddit.com/user/{username}', icon: '🤖' },
  { name: 'YouTube', url: 'https://youtube.com/@{username}', icon: '📺' },
  { name: 'TikTok', url: 'https://tiktok.com/@{username}', icon: '🎵' },
  { name: 'Telegram', url: 'https://t.me/{username}', icon: '✈️' },
  { name: 'Medium', url: 'https://medium.com/@{username}', icon: '📝' },
  { name: 'Twitch', url: 'https://twitch.tv/{username}', icon: '🎮' },
  { name: 'Pinterest', url: 'https://pinterest.com/{username}', icon: '📌' }
]);

const NOT_FOUND_PATTERNS = [
  'page not found', 'user not found', 'account doesn\'t exist',
  'account does not exist', 'sorry, this page isn\'t available'
];

class SocialMediaCollector extends BaseCollector {
  constructor(db, httpClient = null) {
    super('SocialMediaCollector', db, httpClient);
    this.platforms = PLATFORMS;
  }

  async classifyProfile(url, username) {
    const response = await this.makeRequest(url, {
      maxRedirects: 2,
      validateStatus: (status) => [200, 301, 302, 403, 404, 429].includes(status)
    });
    if (response.status === 404) return { status: 'not_found' };
    if ([403, 429].includes(response.status)) return { status: 'unknown', reason: 'blocked_or_rate_limited' };
    if (response.status !== 200) return { status: 'unknown', reason: `http_${response.status}` };

    const html = typeof response.data === 'string' ? response.data.toLowerCase() : '';
    if (NOT_FOUND_PATTERNS.some((pattern) => html.includes(pattern))) return { status: 'not_found' };

    const normalizedUsername = username.replace(/^@/, '').toLowerCase();
    const encoded = normalizedUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const profileEvidence = new RegExp(`(?:@|/|\\b)${encoded}(?:\\b|/|\")`, 'i').test(html);
    return profileEvidence
      ? { status: 'candidate', confidence: 55, reason: 'reachable_with_identifier_evidence' }
      : { status: 'candidate', confidence: 25, reason: 'reachable_url_only' };
  }

  async collect(personId, searchData) {
    const username = searchData.username?.replace(/^@/, '');
    if (!username) {
      await this.log(personId, 'INFO', 'Username discovery skipped');
      return [];
    }

    await this.log(personId, 'INFO', `Checking ${this.platforms.length} public profile URLs`);
    const results = [];
    for (const platform of this.platforms) {
      const url = platform.url.replace('{username}', encodeURIComponent(username));
      try {
        const evidence = await this.classifyProfile(url, username);
        if (evidence.status !== 'candidate') continue;
        const account = {
          platform: platform.name,
          username,
          profileUrl: url,
          verified: false,
          confidenceScore: evidence.confidence,
          additionalData: {
            icon: platform.icon,
            classification: 'candidate',
            evidence: evidence.reason,
            warning: 'Reachability is not identity attribution. Review manually.'
          }
        };
        const id = this.db.addSocialAccount(personId, account);
        results.push({ ...account, id });
      } catch {
        // Network/provider failures are unknown, never evidence that an account exists.
      }
    }
    await this.log(personId, 'SUCCESS', `Stored ${results.length} candidate profile URL(s) for manual review`);
    return results;
  }
}

module.exports = SocialMediaCollector;
