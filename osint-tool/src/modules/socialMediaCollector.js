const BaseCollector = require('./baseCollector');
const cheerio = require('cheerio');

class SocialMediaCollector extends BaseCollector {
  constructor(db) {
    super('SocialMediaCollector', db);

    this.platforms = [
      { name: 'GitHub', urlPattern: 'https://github.com/{username}' },
      { name: 'X', urlPattern: 'https://x.com/{username}' },
      { name: 'Instagram', urlPattern: 'https://instagram.com/{username}' },
      { name: 'Facebook', urlPattern: 'https://facebook.com/{username}' },
      { name: 'LinkedIn', urlPattern: 'https://linkedin.com/in/{username}' },
      { name: 'Reddit', urlPattern: 'https://reddit.com/user/{username}' },
      { name: 'YouTube', urlPattern: 'https://youtube.com/@{username}' },
      { name: 'TikTok', urlPattern: 'https://tiktok.com/@{username}' },
      { name: 'Telegram', urlPattern: 'https://t.me/{username}' },
      { name: 'Medium', urlPattern: 'https://medium.com/@{username}' },
      { name: 'Twitch', urlPattern: 'https://twitch.tv/{username}' },
      { name: 'Pinterest', urlPattern: 'https://pinterest.com/{username}' },
      { name: 'Snapchat', urlPattern: 'https://snapchat.com/add/{username}' }
    ];

    this.notFoundMarkers = [
      'page not found',
      'user not found',
      'account not found',
      "this account doesn't exist",
      'this page isn’t available',
      'this page isn\'t available',
      'sorry, this page isn’t available',
      'sorry, this page isn\'t available',
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
    await this.log(personId, 'INFO', 'Starting conservative public profile URL checks.');

    if (!username) {
      await this.log(personId, 'WARNING', 'Profile checks skipped: no username was provided.');
      return [];
    }

    const results = [];

    for (const platform of this.platforms) {
      const url = platform.urlPattern.replace('{username}', encodeURIComponent(username));
      try {
        const evidence = await this.checkProfile(url, username);
        if (evidence.possibleMatch) {
          const accountData = {
            platform: platform.name,
            username,
            profileUrl: url,
            verified: false,
            confidenceScore: evidence.confidence,
            additionalData: {
              checkMethod: evidence.method,
              httpStatus: evidence.httpStatus,
              finalUrl: evidence.finalUrl,
              titleMatch: evidence.titleMatch,
              checkedAt: new Date().toISOString(),
              caveat: 'Possible public profile URL only; identity is not verified.'
            }
          };

          const accountId = this.db.addSocialAccount(personId, accountData);
          results.push({ ...accountData, id: Number(accountId) });
          await this.log(personId, 'INFO', `Possible ${platform.name} profile found; manual verification required.`);
        } else {
          await this.log(personId, 'INFO', `${platform.name}: no reliable public-profile evidence.`);
        }
      } catch (error) {
        await this.log(personId, 'WARNING', `${platform.name} check was inconclusive: ${error.message}`);
      }

      await this.sleep(300);
    }

    await this.log(personId, 'SUCCESS', `Profile checks completed with ${results.length} possible match(es).`);
    return results;
  }

  async checkProfile(url, username) {
    const response = await this.makeRequest(url, {
      timeout: 12000,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 500
    });

    const httpStatus = Number(response.status);
    const finalUrl = response.request?.res?.responseUrl || url;

    if (httpStatus === 404 || httpStatus === 410) {
      return { possibleMatch: false, confidence: 0, method: 'http_status', httpStatus, finalUrl };
    }

    if ([401, 403, 409, 429].includes(httpStatus) || httpStatus >= 400) {
      return { possibleMatch: false, confidence: 0, method: 'inconclusive_http_status', httpStatus, finalUrl };
    }

    const target = new URL(url);
    const resolved = new URL(finalUrl);
    const finalPath = resolved.pathname.replace(/\/+$/, '').toLowerCase();
    const targetPath = target.pathname.replace(/\/+$/, '').toLowerCase();

    if (resolved.hostname !== target.hostname && !resolved.hostname.endsWith(`.${target.hostname}`)) {
      return { possibleMatch: false, confidence: 0, method: 'cross_host_redirect', httpStatus, finalUrl };
    }

    if (!finalPath || finalPath === '/' || /\/(login|signin|signup|register|explore|home)$/i.test(finalPath)) {
      return { possibleMatch: false, confidence: 0, method: 'generic_redirect', httpStatus, finalUrl };
    }

    const html = typeof response.data === 'string' ? response.data : '';
    const lowerHtml = html.toLowerCase();

    if (this.notFoundMarkers.some((marker) => lowerHtml.includes(marker))) {
      return { possibleMatch: false, confidence: 0, method: 'not_found_marker', httpStatus, finalUrl };
    }

    if (this.blockMarkers.some((marker) => lowerHtml.includes(marker))) {
      return { possibleMatch: false, confidence: 0, method: 'waf_or_challenge', httpStatus, finalUrl };
    }

    const profileData = this.extractProfileData(html);
    const needle = username.toLowerCase();
    const titleMatch = [profileData.displayName, profileData.canonicalUrl]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
    const pathMatch = finalPath === targetPath || finalPath.includes(`/${needle}`) || finalPath.includes(`/@${needle}`);

    if (!pathMatch && !titleMatch) {
      return { possibleMatch: false, confidence: 0, method: 'insufficient_evidence', httpStatus, finalUrl };
    }

    return {
      possibleMatch: true,
      confidence: titleMatch ? 60 : 35,
      method: titleMatch ? 'status_url_title_evidence' : 'status_url_evidence',
      httpStatus,
      finalUrl,
      titleMatch
    };
  }

  async checkAccountExists(url) {
    const username = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '').replace(/^@/, '');
    const evidence = await this.checkProfile(url, username);
    return evidence.possibleMatch;
  }

  extractProfileData(html) {
    if (!html) return {};
    try {
      const $ = cheerio.load(html);
      return {
        displayName: $('meta[property="og:title"]').attr('content') || $('title').text().trim() || '',
        bio: $('meta[property="og:description"]').attr('content') || '',
        avatarUrl: $('meta[property="og:image"]').attr('content') || '',
        canonicalUrl: $('link[rel="canonical"]').attr('href') || $('meta[property="og:url"]').attr('content') || ''
      };
    } catch {
      return {};
    }
  }
}

module.exports = SocialMediaCollector;
