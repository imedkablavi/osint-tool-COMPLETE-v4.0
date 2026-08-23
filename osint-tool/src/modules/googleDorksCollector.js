const BaseCollector = require('./baseCollector');

/**
 * SearchQueryBuilder
 *
 * This module intentionally does not scrape Google result pages. HTML scraping
 * is brittle, frequently blocked, and the previous implementation attempted to
 * save through a database method that does not exist. The commercial pipeline
 * only stores results returned by auditable source adapters.
 *
 * The query builder remains useful for generating investigator-assisted search
 * URLs. A future web-search API adapter (for example Brave Search API with an
 * explicit user-provided key and consent) can consume the same query list.
 */
class GoogleDorksCollector extends BaseCollector {
  constructor(db) {
    super('SearchQueryBuilder', db);
  }

  getTemplates() {
    return {
      email: [
        '"{email}"',
        '"{email}" site:github.com',
        '"{email}" filetype:pdf'
      ],
      username: [
        '"{username}"',
        '"{username}" site:github.com',
        '"{username}" site:gitlab.com',
        '"{username}" site:news.ycombinator.com',
        'inurl:"{username}"'
      ],
      fullname: [
        '"{fullname}"',
        '"{fullname}" filetype:pdf',
        '"{fullname}" site:github.com OR site:gitlab.com'
      ]
    };
  }

  buildQueries(searchData = {}) {
    const templates = this.getTemplates();
    const queries = [];

    this.appendQueries(queries, 'email', templates.email, '{email}', searchData.email);
    this.appendQueries(queries, 'username', templates.username, '{username}', searchData.username);
    this.appendQueries(queries, 'fullname', templates.fullname, '{fullname}', searchData.name || searchData.fullname);

    return queries.slice(0, 20);
  }

  appendQueries(target, category, templates, placeholder, rawValue) {
    const value = String(rawValue || '').trim().replace(/[\u0000-\u001F\u007F]/g, '');
    if (!value) return;

    for (const template of templates) {
      target.push({ category, query: template.replace(placeholder, value) });
    }
  }

  buildSearchUrls(searchData = {}, engine = 'google') {
    const baseUrl = engine === 'brave'
      ? 'https://search.brave.com/search?q='
      : 'https://www.google.com/search?q=';

    return this.buildQueries(searchData).map((item) => ({
      ...item,
      url: `${baseUrl}${encodeURIComponent(item.query)}`
    }));
  }

  async collect(personId, searchData) {
    const queries = this.buildQueries(searchData);
    await this.log(
      personId,
      'INFO',
      `Generated ${queries.length} investigator-assisted search queries. Automated search-engine scraping is disabled; no unverified search results were stored.`
    );
    return [];
  }
}

module.exports = GoogleDorksCollector;
