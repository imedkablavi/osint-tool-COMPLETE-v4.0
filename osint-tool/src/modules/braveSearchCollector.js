const BaseCollector = require('./baseCollector');

class BraveSearchCollector extends BaseCollector {
  constructor(db, apiKey = '') {
    super('BraveSearchCollector', db);
    this.apiKey = String(apiKey || '').trim();
    this.endpoint = 'https://api.search.brave.com/res/v1/web/search';
    this.maxQueries = 6;
    this.resultsPerQuery = 8;
  }

  setApiKey(apiKey = '') {
    this.apiKey = String(apiKey || '').trim();
  }

  buildQueryPlan(searchData = {}) {
    const email = this.cleanValue(searchData.email, 320);
    const username = this.cleanValue(searchData.username, 120).replace(/^@+/, '');
    const name = this.cleanValue(searchData.name || searchData.fullname, 180);
    const queries = [];

    if (email) {
      queries.push({ category: 'email_exact', query: `"${email}"` });
      queries.push({ category: 'email_documents', query: `"${email}" filetype:pdf` });
    }
    if (username) {
      queries.push({ category: 'username_exact', query: `"${username}"` });
      queries.push({ category: 'username_url', query: `inurl:"${username}"` });
    }
    if (name) {
      queries.push({ category: 'name_exact', query: `"${name}"` });
      queries.push({ category: 'name_documents', query: `"${name}" filetype:pdf` });
    }

    const seen = new Set();
    return queries.filter((item) => {
      const key = item.query.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, this.maxQueries);
  }

  cleanValue(value, maxLength) {
    return String(value || '')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .replace(/["\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  stripMarkup(value) {
    return String(value || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  async collect(personId, searchData = {}) {
    if (!this.apiKey) {
      await this.log(personId, 'WARNING', 'Brave Search skipped: no API key is configured.');
      return [];
    }

    const plan = this.buildQueryPlan(searchData);
    if (!plan.length) {
      await this.log(personId, 'INFO', 'Brave Search skipped: no usable search identifiers were provided.');
      return [];
    }

    await this.log(personId, 'INFO', `Running ${plan.length} bounded Brave Search API quer${plan.length === 1 ? 'y' : 'ies'}.`);
    const collected = [];
    const seenUrls = new Set(
      typeof this.db?.getSearchResults === 'function'
        ? this.db.getSearchResults(personId).map((row) => this.normalizeUrl(row.url)).filter(Boolean)
        : []
    );

    for (const item of plan) {
      let response;
      try {
        response = await this.search(item.query);
      } catch (error) {
        await this.log(personId, 'WARNING', `Brave Search query failed (${item.category}): ${error.message}`);
        continue;
      }

      const rows = Array.isArray(response?.web?.results) ? response.web.results : [];
      for (let index = 0; index < rows.length; index++) {
        const mapped = this.mapResult(rows[index], item, index);
        if (!mapped) continue;
        const normalizedUrl = this.normalizeUrl(mapped.url);
        if (!normalizedUrl || seenUrls.has(normalizedUrl)) continue;
        seenUrls.add(normalizedUrl);

        const id = this.db.addSearchResult(personId, mapped);
        const observedAt = new Date().toISOString();
        const evidenceId = this.recordEvidence(personId, {
          sourceName: 'Brave Search API',
          sourceType: 'official_search_api',
          entityType: 'search_result',
          entityId: id,
          evidenceType: 'web_search_result',
          sourceUrl: mapped.url,
          status: 'observed',
          qualityScore: 85,
          observedAt,
          metadata: {
            queryCategory: item.category,
            query: item.query,
            rank: index + 1,
            provider: 'Brave Search API',
            resultLanguage: mapped.language || null,
            resultAge: mapped.age || null,
            caveat: 'A search-engine result is retrieval evidence for the query, not proof that the page refers to the investigated person.'
          }
        });

        collected.push({
          id: Number(id),
          evidenceId: evidenceId ? Number(evidenceId) : null,
          ...mapped,
          queryCategory: item.category,
          rank: index + 1
        });
      }
    }

    await this.log(personId, 'SUCCESS', `Brave Search stored ${collected.length} deduplicated web result(s).`);
    return collected;
  }

  async search(query) {
    const response = await this.makeRequest(this.endpoint, {
      timeout: 20000,
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': this.apiKey,
        'User-Agent': 'OSINT-Tool/4.1 (+https://github.com/imedkablavi/osint-tool-COMPLETE-v4.0)'
      },
      params: {
        q: String(query).slice(0, 400),
        count: this.resultsPerQuery,
        safesearch: 'strict',
        extra_snippets: false
      },
      validateStatus: (status) => [200, 401, 403, 422, 429].includes(status)
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('API key was rejected.');
    }
    if (response.status === 422) {
      throw new Error('query was rejected by the provider.');
    }
    if (response.status === 429) {
      throw new Error('rate limit reached.');
    }
    if (response.status !== 200) {
      throw new Error(`provider returned HTTP ${response.status}.`);
    }
    return response.data || {};
  }

  mapResult(raw = {}, queryItem = {}, index = 0) {
    const url = this.normalizeUrl(raw.url);
    if (!url) return null;

    return {
      source: 'Brave Search API',
      title: this.stripMarkup(raw.title) || url,
      url,
      snippet: this.stripMarkup(raw.description),
      dateFound: new Date().toISOString(),
      relevanceScore: 0,
      age: raw.age || null,
      language: raw.language || null,
      query: queryItem.query || null,
      category: queryItem.category || null,
      rank: index + 1
    };
  }

  normalizeUrl(rawUrl) {
    try {
      const url = new URL(String(rawUrl || '').trim());
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      url.hash = '';
      return url.toString();
    } catch {
      return '';
    }
  }
}

module.exports = BraveSearchCollector;
