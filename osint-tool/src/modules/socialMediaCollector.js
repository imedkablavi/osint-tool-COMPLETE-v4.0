const BaseCollector = require('./baseCollector');
const cheerio = require('cheerio');

class SocialMediaCollector extends BaseCollector {
  constructor(db) {
    super('PublicProfileCollector', db);

    this.apiProviders = [
      { name: 'GitHub', check: (username) => this.checkGitHub(username) },
      { name: 'GitLab', check: (username) => this.checkGitLab(username) },
      { name: 'Hacker News', check: (username) => this.checkHackerNews(username) }
    ];

    this.pageProviders = [
      { name: 'Telegram', urlPattern: 'https://t.me/{username}' },
      { name: 'Medium', urlPattern: 'https://medium.com/@{username}' },
      { name: 'Twitch', urlPattern: 'https://www.twitch.tv/{username}' },
      { name: 'Pinterest', urlPattern: 'https://www.pinterest.com/{username}/' }
    ];

    this.notFoundMarkers = [
      'page not found',
      'user not found',
      'account not found',
      "this account doesn't exist",
      'this page isn’t available',
      "this page isn't available",
      'profile not found',
      'nothing here'
    ];

    this.blockMarkers = [
      'cf-chl-',
      'challenge-error-text',
      'captcha',
      'access denied',
      'enable javascript and cookies to continue'
    ];
  }

  async collect(personId, searchData) {
    const username = String(searchData?.username || '').trim().replace(/^@+/, '');
    await this.log(personId, 'INFO', 'Starting public profile collection from supported live sources.');

    if (!username) {
      await this.log(personId, 'WARNING', 'Public profile collection skipped: no username was provided.');
      return [];
    }

    const results = [];

    for (const provider of this.apiProviders) {
      try {
        const accountData = await provider.check(username);
        if (!accountData) {
          await this.log(personId, 'INFO', `${provider.name}: exact username not found.`);
          continue;
        }

        const accountId = this.db.addSocialAccount(personId, accountData);
        this.recordAccountEvidence(personId, accountId, accountData);
        results.push({ ...accountData, id: Number(accountId) });
        await this.log(personId, 'SUCCESS', `${provider.name}: exact public account returned by the provider API.`);
      } catch (error) {
        await this.log(personId, 'WARNING', `${provider.name} API check was inconclusive: ${error.message}`);
      }
    }

    for (const provider of this.pageProviders) {
      const url = provider.urlPattern.replace('{username}', encodeURIComponent(username));
      try {
        const evidence = await this.checkPublicPage(url, username);
        if (!evidence.possibleMatch) {
          await this.log(personId, 'INFO', `${provider.name}: no reliable public-page evidence.`);
          continue;
        }

        const accountData = {
          platform: provider.name,
          username,
          displayName: evidence.profileData.displayName || null,
          profileUrl: evidence.finalUrl || url,
          bio: evidence.profileData.bio || null,
          avatarUrl: evidence.profileData.avatarUrl || null,
          verified: false,
          confidenceScore: evidence.confidence,
          additionalData: {
            source: provider.name,
            sourceKind: 'public_page_probe',
            checkMethod: evidence.method,
            httpStatus: evidence.httpStatus,
            canonicalUrl: evidence.profileData.canonicalUrl || null,
            checkedAt: new Date().toISOString(),
            evidenceQuality: evidence.confidence,
            caveat: 'Public page evidence only; account ownership or identity is not verified.'
          }
        };

        const accountId = this.db.addSocialAccount(personId, accountData);
        this.recordAccountEvidence(personId, accountId, accountData);
        results.push({ ...accountData, id: Number(accountId) });
        await this.log(personId, 'INFO', `${provider.name}: possible public profile page found; manual verification required.`);
      } catch (error) {
        await this.log(personId, 'WARNING', `${provider.name} page check was inconclusive: ${error.message}`);
      }
    }

    await this.log(personId, 'SUCCESS', `Public profile collection completed with ${results.length} result(s).`);
    return results;
  }

  recordAccountEvidence(personId, accountId, accountData) {
    const metadata = accountData.additionalData || {};
    this.recordEvidence(personId, {
      sourceName: metadata.source || accountData.platform,
      sourceType: metadata.sourceKind || 'public_source',
      entityType: 'social_account',
      entityId: accountId,
      evidenceType: metadata.sourceKind === 'official_public_api'
        ? 'exact_username_api_record'
        : 'public_page_observation',
      sourceUrl: accountData.profileUrl || null,
      status: 'observed',
      qualityScore: accountData.confidenceScore,
      observedAt: metadata.checkedAt || null,
      metadata
    });
  }

  async checkGitHub(username) {
    const response = await this.makeRequest(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      timeout: 15000,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10',
        'User-Agent': 'OSINT-Tool/4.1 (+https://github.com/imedkablavi/osint-tool-COMPLETE-v4.0)'
      },
      validateStatus: (status) => [200, 403, 404, 429].includes(status)
    });

    if (response.status === 404) return null;
    if (response.status === 403 || response.status === 429) {
      throw new Error('rate limit reached');
    }

    return this.mapGitHubProfile(username, response.data);
  }

  mapGitHubProfile(username, data = {}) {
    if (!data.login || String(data.login).toLowerCase() !== username.toLowerCase()) return null;

    return {
      platform: 'GitHub',
      username: data.login,
      displayName: data.name || null,
      profileUrl: data.html_url || `https://github.com/${encodeURIComponent(data.login)}`,
      bio: data.bio || null,
      avatarUrl: data.avatar_url || null,
      followersCount: Number.isFinite(Number(data.followers)) ? Number(data.followers) : null,
      followingCount: Number.isFinite(Number(data.following)) ? Number(data.following) : null,
      verified: false,
      lastPostDate: data.updated_at || null,
      confidenceScore: 95,
      additionalData: {
        source: 'GitHub REST API',
        sourceKind: 'official_public_api',
        providerId: data.id ?? null,
        accountType: data.type || null,
        company: data.company || null,
        location: data.location || null,
        publicEmail: data.email || null,
        website: data.blog || null,
        twitterUsername: data.twitter_username || null,
        publicRepos: data.public_repos ?? null,
        publicGists: data.public_gists ?? null,
        createdAt: data.created_at || null,
        checkedAt: new Date().toISOString(),
        evidenceQuality: 95,
        caveat: 'Exact username exists on GitHub; this does not prove it belongs to the investigated person.'
      }
    };
  }

  async checkGitLab(username) {
    const response = await this.makeRequest('https://gitlab.com/api/v4/users', {
      timeout: 15000,
      params: { username, per_page: 5 },
      headers: {
        Accept: 'application/json',
        'User-Agent': 'OSINT-Tool/4.1 (+https://github.com/imedkablavi/osint-tool-COMPLETE-v4.0)'
      },
      validateStatus: (status) => [200, 403, 404, 429].includes(status)
    });

    if (response.status === 404) return null;
    if (response.status === 403 || response.status === 429) throw new Error('rate limit or access restriction');

    const users = Array.isArray(response.data) ? response.data : [];
    const exact = users.find((user) => String(user.username || '').toLowerCase() === username.toLowerCase());
    return exact ? this.mapGitLabProfile(username, exact) : null;
  }

  mapGitLabProfile(username, data = {}) {
    if (!data.username || String(data.username).toLowerCase() !== username.toLowerCase()) return null;

    return {
      platform: 'GitLab',
      username: data.username,
      displayName: data.name || null,
      profileUrl: data.web_url || `https://gitlab.com/${encodeURIComponent(data.username)}`,
      bio: data.bio || null,
      avatarUrl: data.avatar_url || null,
      followersCount: Number.isFinite(Number(data.followers)) ? Number(data.followers) : null,
      followingCount: Number.isFinite(Number(data.following)) ? Number(data.following) : null,
      verified: false,
      lastPostDate: data.last_activity_on || null,
      confidenceScore: 95,
      additionalData: {
        source: 'GitLab Users API',
        sourceKind: 'official_public_api',
        providerId: data.id ?? null,
        state: data.state || null,
        location: data.location || null,
        publicEmail: data.public_email || null,
        website: data.website_url || null,
        organization: data.organization || null,
        jobTitle: data.job_title || null,
        createdAt: data.created_at || null,
        checkedAt: new Date().toISOString(),
        evidenceQuality: 95,
        caveat: 'Exact username exists on GitLab; this does not prove it belongs to the investigated person.'
      }
    };
  }

  async checkHackerNews(username) {
    const response = await this.makeRequest(
      `https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(username)}.json`,
      {
        timeout: 15000,
        headers: { 'User-Agent': 'OSINT-Tool/4.1' },
        validateStatus: (status) => status === 200 || status === 404
      }
    );

    if (response.status === 404 || !response.data) return null;
    return this.mapHackerNewsProfile(username, response.data);
  }

  mapHackerNewsProfile(username, data = {}) {
    if (!data.id || String(data.id) !== username) return null;

    return {
      platform: 'Hacker News',
      username: data.id,
      displayName: data.id,
      profileUrl: `https://news.ycombinator.com/user?id=${encodeURIComponent(data.id)}`,
      bio: this.htmlToText(data.about || ''),
      verified: false,
      confidenceScore: 95,
      additionalData: {
        source: 'Official Hacker News API',
        sourceKind: 'official_public_api',
        karma: Number.isFinite(Number(data.karma)) ? Number(data.karma) : null,
        createdAt: Number.isFinite(Number(data.created)) ? new Date(Number(data.created) * 1000).toISOString() : null,
        submittedCount: Array.isArray(data.submitted) ? data.submitted.length : 0,
        checkedAt: new Date().toISOString(),
        evidenceQuality: 95,
        caveat: 'Exact case-sensitive username exists on Hacker News; this does not prove identity ownership.'
      }
    };
  }

  async checkPublicPage(url, username) {
    const response = await this.makeRequest(url, {
      timeout: 12000,
      maxRedirects: 5,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; OSINT-Tool/4.1; +https://github.com/imedkablavi/osint-tool-COMPLETE-v4.0)'
      },
      validateStatus: (status) => status >= 200 && status < 500
    });

    const httpStatus = Number(response.status);
    const finalUrl = response.request?.res?.responseUrl || url;

    if (httpStatus === 404 || httpStatus === 410) {
      return { possibleMatch: false, confidence: 0, method: 'http_status', httpStatus, finalUrl, profileData: {} };
    }
    if ([401, 403, 409, 429].includes(httpStatus) || httpStatus >= 400) {
      return { possibleMatch: false, confidence: 0, method: 'inconclusive_http_status', httpStatus, finalUrl, profileData: {} };
    }

    const target = new URL(url);
    const resolved = new URL(finalUrl);
    const finalPath = resolved.pathname.replace(/\/+$/, '').toLowerCase();
    const targetPath = target.pathname.replace(/\/+$/, '').toLowerCase();

    if (resolved.hostname !== target.hostname && !resolved.hostname.endsWith(`.${target.hostname}`)) {
      return { possibleMatch: false, confidence: 0, method: 'cross_host_redirect', httpStatus, finalUrl, profileData: {} };
    }
    if (!finalPath || finalPath === '/' || /\/(login|signin|signup|register|explore|home)$/i.test(finalPath)) {
      return { possibleMatch: false, confidence: 0, method: 'generic_redirect', httpStatus, finalUrl, profileData: {} };
    }

    const html = typeof response.data === 'string' ? response.data : '';
    const lowerHtml = html.toLowerCase();
    if (this.notFoundMarkers.some((marker) => lowerHtml.includes(marker))) {
      return { possibleMatch: false, confidence: 0, method: 'not_found_marker', httpStatus, finalUrl, profileData: {} };
    }
    if (this.blockMarkers.some((marker) => lowerHtml.includes(marker))) {
      return { possibleMatch: false, confidence: 0, method: 'waf_or_challenge', httpStatus, finalUrl, profileData: {} };
    }

    const profileData = this.extractProfileData(html);
    const needle = username.toLowerCase();
    const metadataMatch = [profileData.displayName, profileData.canonicalUrl]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
    const pathMatch = finalPath === targetPath || finalPath.includes(`/${needle}`) || finalPath.includes(`/@${needle}`);

    if (!pathMatch && !metadataMatch) {
      return { possibleMatch: false, confidence: 0, method: 'insufficient_evidence', httpStatus, finalUrl, profileData };
    }

    return {
      possibleMatch: true,
      confidence: metadataMatch ? 55 : 30,
      method: metadataMatch ? 'public_page_metadata' : 'public_page_url',
      httpStatus,
      finalUrl,
      profileData
    };
  }

  extractProfileData(html) {
    if (!html) return {};
    try {
      const $ = cheerio.load(html);
      return {
        displayName: $('meta[property="og:title"]').attr('content') || $('title').text().trim() || '',
        bio: $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '',
        avatarUrl: $('meta[property="og:image"]').attr('content') || '',
        canonicalUrl: $('link[rel="canonical"]').attr('href') || $('meta[property="og:url"]').attr('content') || ''
      };
    } catch {
      return {};
    }
  }

  htmlToText(html) {
    if (!html) return '';
    try {
      return cheerio.load(`<div>${html}</div>`).text().replace(/\s+/g, ' ').trim();
    } catch {
      return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }
}

module.exports = SocialMediaCollector;
