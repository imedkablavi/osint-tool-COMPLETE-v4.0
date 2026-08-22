const BaseCollector = require('./baseCollector');

/**
 * FaceSearchEngine compatibility boundary.
 *
 * Previous revisions generated synthetic reverse-image/face-search matches for
 * Google, Yandex, Bing, TinEye and PimEyes. Fabricated matches are not valid
 * evidence and must never enter a commercial investigation report.
 *
 * This module therefore returns an explicit unavailable state until a real,
 * licensed provider adapter is implemented. Local image metadata analysis can
 * be implemented separately without claiming a remote face match.
 */
class FaceSearchEngine extends BaseCollector {
  constructor(db) {
    super('FaceSearchEngine', db);
  }

  async searchFace(_imagePath, _options = {}) {
    return {
      success: false,
      unavailable: true,
      error: 'Reverse face search is disabled because no audited live provider adapter is configured.',
      results: {
        high: [],
        medium: [],
        low: []
      },
      stats: {
        total: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0
      }
    };
  }

  classifyResults(results = []) {
    return {
      high: results.filter((result) => Number(result.confidence) >= 0.80),
      medium: results.filter((result) => Number(result.confidence) >= 0.65 && Number(result.confidence) < 0.80),
      low: results.filter((result) => Number(result.confidence) >= 0.50 && Number(result.confidence) < 0.65)
    };
  }

  removeDuplicates(results = []) {
    const seen = new Set();
    return results.filter((result) => {
      const key = `${result.url || ''}|${result.pageUrl || ''}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

module.exports = FaceSearchEngine;
