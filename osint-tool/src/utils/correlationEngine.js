const { backfillEvidence } = require('./evidenceRecorder');

class CorrelationEngine {
  constructor(db) {
    this.db = db;
  }

  calculateSimilarity(account1, account2) {
    const factors = {};
    let totalWeight = 0;

    if (account1.username && account2.username) {
      const usernameMatch = this.compareStrings(account1.username, account2.username);
      factors.username = usernameMatch * 30;
      totalWeight += 30;
    }

    if (account1.display_name && account2.display_name) {
      const nameMatch = this.compareStrings(account1.display_name, account2.display_name);
      factors.displayName = nameMatch * 25;
      totalWeight += 25;
    }

    if (account1.avatar_url && account2.avatar_url) {
      const avatarMatch = account1.avatar_url === account2.avatar_url ? 1 : 0;
      factors.avatar = avatarMatch * 20;
      totalWeight += 20;
    }

    if (account1.bio && account2.bio) {
      const bioMatch = this.compareStrings(account1.bio, account2.bio);
      factors.bio = bioMatch * 15;
      totalWeight += 15;
    }

    if (account1.verified && account2.verified) {
      factors.verified = 10;
      totalWeight += 10;
    }

    const totalScore = Object.values(factors).reduce((sum, value) => sum + value, 0);
    const similarity = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;

    return {
      similarity: Math.round(similarity * 100) / 100,
      factors,
      confidence: this.getConfidenceLevel(similarity),
      meaning: 'attribute_similarity_not_identity_probability'
    };
  }

  compareStrings(str1, str2) {
    if (!str1 || !str2) return 0;
    const s1 = String(str1).toLowerCase().trim();
    const s2 = String(str2).toLowerCase().trim();
    if (s1 === s2) return 1;
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  getConfidenceLevel(score) {
    if (score >= 90) return 'عالي جداً';
    if (score >= 75) return 'عالي';
    if (score >= 60) return 'متوسط';
    if (score >= 40) return 'منخفض';
    return 'منخفض جداً';
  }

  safeJson(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  buildRelationshipGraph(personId) {
    const person = this.db.getPerson(personId);
    const socialAccounts = this.db.getSocialAccounts(personId);
    const breaches = this.db.getBreaches(personId);
    const domains = this.db.getDomains(personId);
    const nodes = [];
    const edges = [];

    nodes.push({
      id: `person_${personId}`,
      type: 'person',
      label: person?.name || person?.email || person?.username || 'Unknown',
      data: person,
      group: 'person'
    });

    socialAccounts.forEach((account) => {
      const metadata = this.safeJson(account.additional_data, {});
      nodes.push({
        id: `social_${account.id}`,
        type: 'social',
        label: `${account.platform}\n@${account.username}`,
        data: account,
        group: account.platform,
        icon: metadata.icon || '👤'
      });

      edges.push({
        from: `person_${personId}`,
        to: `social_${account.id}`,
        label: 'مطابقة اسم مستخدم',
        confidence: Number(account.confidence_score) || 0,
        meaning: 'source_evidence_quality'
      });
    });

    breaches.forEach((breach) => {
      nodes.push({
        id: `breach_${breach.id}`,
        type: 'breach',
        label: `تسريب: ${breach.breach_name}`,
        data: breach,
        group: 'breach'
      });

      edges.push({
        from: `person_${personId}`,
        to: `breach_${breach.id}`,
        label: 'البريد ظهر في',
        confidence: breach.verified ? 100 : 60,
        meaning: 'source_record_confidence'
      });
    });

    domains.forEach((domain) => {
      nodes.push({
        id: `domain_${domain.id}`,
        type: 'domain',
        label: domain.domain_name,
        data: domain,
        group: 'domain'
      });

      edges.push({
        from: `person_${personId}`,
        to: `domain_${domain.id}`,
        label: 'نطاق البريد',
        confidence: this.domainEvidenceQuality(domain),
        meaning: 'email_domain_relationship_not_domain_ownership'
      });
    });

    for (let i = 0; i < socialAccounts.length; i++) {
      for (let j = i + 1; j < socialAccounts.length; j++) {
        const similarity = this.calculateSimilarity(socialAccounts[i], socialAccounts[j]);
        if (similarity.similarity > 60) {
          edges.push({
            from: `social_${socialAccounts[i].id}`,
            to: `social_${socialAccounts[j].id}`,
            label: `تشابه سمات: ${similarity.similarity}%`,
            confidence: similarity.similarity,
            meaning: 'attribute_similarity_not_identity_probability',
            dashed: true
          });
        }
      }
    }

    return { nodes, edges };
  }

  analyzeTemporalPatterns(personId) {
    const socialAccounts = this.db.getSocialAccounts(personId);
    const patterns = {};
    socialAccounts.forEach((account) => {
      if (!account.last_post_date) return;
      const date = new Date(account.last_post_date);
      if (Number.isNaN(date.getTime())) return;
      const hour = date.getHours();
      patterns[hour] = (patterns[hour] || 0) + 1;
    });
    return patterns;
  }

  domainEvidenceQuality(domain) {
    const metadata = this.safeJson(domain.additional_data, {});
    const status = metadata.sourceStatus || {};
    let score = 0;
    let sources = 0;

    if (status.rdap === 'ok') {
      score += 95;
      sources++;
    }
    if (status.dns === 'ok') {
      score += 95;
      sources++;
    }
    if (status.certificateTransparency === 'ok') {
      score += 80;
      sources++;
    }

    if (sources === 0 && metadata.rdap) return 90;
    if (sources === 0 && metadata.source === 'RDAP') return 90;
    return sources > 0 ? score / sources : 50;
  }

  calculateOverallConfidence(personId) {
    const socialAccounts = this.db.getSocialAccounts(personId);
    const breaches = this.db.getBreaches(personId);
    const domains = this.db.getDomains(personId);
    let total = 0;
    let count = 0;

    socialAccounts.forEach((account) => {
      total += Number(account.confidence_score) || 0;
      count++;
    });
    breaches.forEach((breach) => {
      total += breach.verified ? 100 : 60;
      count++;
    });
    domains.forEach((domain) => {
      total += this.domainEvidenceQuality(domain);
      count++;
    });

    return count > 0 ? total / count : 0;
  }

  generateReport(personId) {
    const evidenceAdded = backfillEvidence(this.db, personId);
    const person = this.db.getPerson(personId);
    const socialAccounts = this.db.getSocialAccounts(personId);
    const breaches = this.db.getBreaches(personId);
    const domains = this.db.getDomains(personId);
    const searchResults = typeof this.db.getSearchResults === 'function' ? this.db.getSearchResults(personId) : [];
    const media = typeof this.db.getMedia === 'function' ? this.db.getMedia(personId) : [];
    const logs = this.db.getLogs(personId);
    const evidence = typeof this.db.getEvidence === 'function' ? this.db.getEvidence(personId) : [];
    const graph = this.buildRelationshipGraph(personId);
    const overallConfidence = this.calculateOverallConfidence(personId);

    return {
      person,
      summary: {
        totalSocialAccounts: socialAccounts.length,
        totalBreaches: breaches.length,
        totalDomains: domains.length,
        totalSearchResults: searchResults.length,
        totalMediaEvidence: media.length,
        totalEvidenceRecords: evidence.length,
        overallConfidence: Math.round(overallConfidence * 100) / 100,
        confidenceLevel: this.getConfidenceLevel(overallConfidence),
        scoreMeaning: 'source_evidence_quality_not_identity_probability'
      },
      socialAccounts,
      breaches,
      domains,
      searchResults,
      media,
      evidence,
      graph,
      logs: logs.slice(0, 50),
      provenance: {
        evidenceSchema: 1,
        recordsBackfilledThisRun: evidenceAdded,
        note: 'Evidence quality scores describe source/observation quality, not identity probability. Search results are retrieval evidence and are excluded from aggregate identity-style scoring.'
      }
    };
  }
}

module.exports = CorrelationEngine;
