const BaseCollector = require('./baseCollector');

/**
 * EvidenceScorer
 *
 * This module no longer pretends to orchestrate collectors through non-existent
 * `.search()` methods. Collection belongs to the live source adapters. This
 * class only scores already-collected candidate attributes against explicit
 * case criteria and reports which fields contributed to the score.
 */
class MultiDimensionalSearchEngine extends BaseCollector {
  constructor(db) {
    super('EvidenceScorer', db);
    this.weights = {
      email: 1.0,
      username: 0.9,
      fullName: 0.75,
      website: 0.65,
      company: 0.45,
      location: 0.35,
      bio: 0.20
    };
  }

  scoreCandidate(candidate = {}, criteria = {}) {
    const factors = [];
    let weightedScore = 0;
    let availableWeight = 0;

    this.compareExact(factors, 'email', candidate.email || candidate.publicEmail, criteria.email);
    this.compareExact(factors, 'username', candidate.username, criteria.username);
    this.compareText(factors, 'fullName', candidate.fullName || candidate.name || candidate.displayName, criteria.fullName || criteria.name);
    this.compareUrl(factors, 'website', candidate.website || candidate.url, criteria.website);
    this.compareText(factors, 'company', candidate.company || candidate.organization, criteria.company);
    this.compareText(factors, 'location', candidate.location, criteria.location);
    this.compareText(factors, 'bio', candidate.bio, criteria.bio);

    for (const factor of factors) {
      const weight = this.weights[factor.field] || 0;
      weightedScore += factor.similarity * weight;
      availableWeight += weight;
    }

    const score = availableWeight > 0 ? (weightedScore / availableWeight) * 100 : 0;
    return {
      score: Math.round(score * 100) / 100,
      factors,
      meaning: 'attribute_similarity_not_identity_probability'
    };
  }

  scoreAll(candidates = [], criteria = {}) {
    return candidates
      .map((candidate) => ({ candidate, ...this.scoreCandidate(candidate, criteria) }))
      .sort((a, b) => b.score - a.score);
  }

  compareExact(factors, field, left, right) {
    if (!left || !right) return;
    const a = this.normalize(left);
    const b = this.normalize(right);
    factors.push({ field, similarity: a === b ? 1 : 0, left: String(left), right: String(right) });
  }

  compareText(factors, field, left, right) {
    if (!left || !right) return;
    factors.push({
      field,
      similarity: this.stringSimilarity(String(left), String(right)),
      left: String(left),
      right: String(right)
    });
  }

  compareUrl(factors, field, left, right) {
    if (!left || !right) return;
    try {
      const a = new URL(String(left));
      const b = new URL(String(right));
      const sameHost = a.hostname.toLowerCase() === b.hostname.toLowerCase();
      const samePath = a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '');
      factors.push({ field, similarity: sameHost ? (samePath ? 1 : 0.75) : 0, left: a.href, right: b.href });
    } catch {
      this.compareText(factors, field, left, right);
    }
  }

  stringSimilarity(left, right) {
    const a = this.normalize(left);
    const b = this.normalize(right);
    if (!a || !b) return 0;
    if (a === b) return 1;

    const distance = this.levenshtein(a, b);
    return Math.max(0, 1 - distance / Math.max(a.length, b.length));
  }

  levenshtein(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const current = row[j];
        row[j] = a[i - 1] === b[j - 1]
          ? previous
          : Math.min(previous + 1, row[j] + 1, row[j - 1] + 1);
        previous = current;
      }
    }
    return row[b.length];
  }

  normalize(value) {
    return String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  }
}

module.exports = MultiDimensionalSearchEngine;
