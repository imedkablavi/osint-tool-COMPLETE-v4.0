class CorrelationEngine {
  constructor(db) {
    this.db = db;
  }

  // حساب نسبة التشابه بين حسابين
  calculateSimilarity(account1, account2) {
    const factors = {};
    let totalWeight = 0;

    // 1. تشابه اسم المستخدم (وزن: 30)
    if (account1.username && account2.username) {
      const usernameMatch = this.compareStrings(account1.username, account2.username);
      factors.username = usernameMatch * 30;
      totalWeight += 30;
    }

    // 2. تشابه الاسم المعروض (وزن: 25)
    if (account1.display_name && account2.display_name) {
      const nameMatch = this.compareStrings(account1.display_name, account2.display_name);
      factors.displayName = nameMatch * 25;
      totalWeight += 25;
    }

    // 3. تشابه الصورة الشخصية (وزن: 20)
    if (account1.avatar_url && account2.avatar_url) {
      // في الإصدار المتقدم، يتم استخدام perceptual hashing
      const avatarMatch = account1.avatar_url === account2.avatar_url ? 1 : 0;
      factors.avatar = avatarMatch * 20;
      totalWeight += 20;
    }

    // 4. تشابه النبذة (وزن: 15)
    if (account1.bio && account2.bio) {
      const bioMatch = this.compareStrings(account1.bio, account2.bio);
      factors.bio = bioMatch * 15;
      totalWeight += 15;
    }

    // 5. التحقق من الحساب (وزن: 10)
    if (account1.verified && account2.verified) {
      factors.verified = 10;
      totalWeight += 10;
    }

    // حساب النسبة النهائية
    const totalScore = Object.values(factors).reduce((sum, val) => sum + val, 0);
    const similarity = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;

    return {
      similarity: Math.round(similarity * 100) / 100,
      factors: factors,
      confidence: this.getConfidenceLevel(similarity)
    };
  }

  // مقارنة نصين باستخدام Levenshtein distance
  compareStrings(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;

    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    
    if (maxLength === 0) return 1;
    
    return 1 - (distance / maxLength);
  }

  // حساب Levenshtein distance
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

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

  // تحديد مستوى الثقة
  getConfidenceLevel(similarity) {
    if (similarity >= 90) return 'عالي جداً';
    if (similarity >= 75) return 'عالي';
    if (similarity >= 60) return 'متوسط';
    if (similarity >= 40) return 'منخفض';
    return 'منخفض جداً';
  }

  // بناء شبكة العلاقات (Graph)
  buildRelationshipGraph(personId) {
    const person = this.db.getPerson(personId);
    if (!person) return { nodes: [], edges: [] };
    const socialAccounts = this.db.getSocialAccounts(personId);
    const breaches = this.db.getBreaches(personId);
    const domains = this.db.getDomains(personId);

    const nodes = [];
    const edges = [];

    // العقدة المركزية: الشخص
    nodes.push({
      id: `person_${personId}`,
      type: 'person',
      label: person.name || person.email || person.username || 'Unknown',
      data: person,
      group: 'person'
    });

    // عقد الحسابات الاجتماعية
    socialAccounts.forEach(account => {
      nodes.push({
        id: `social_${account.id}`,
        type: 'social',
        label: `${account.platform}\n@${account.username}`,
        data: account,
        group: account.platform,
        icon: account.additional_data ? JSON.parse(account.additional_data).icon : '👤'
      });

      edges.push({
        from: `person_${personId}`,
        to: `social_${account.id}`,
        label: 'حساب مرشح',
        confidence: account.confidence_score
      });
    });

    // عقد التسريبات
    breaches.forEach(breach => {
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
        label: 'ظهر في',
        confidence: breach.verified ? 100 : 50
      });
    });

    // عقد النطاقات
    domains.forEach(domain => {
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
        label: 'نطاق بريد/مدخل',
        confidence: 80
      });
    });

    // إضافة علاقات بين الحسابات المتشابهة
    for (let i = 0; i < socialAccounts.length; i++) {
      for (let j = i + 1; j < socialAccounts.length; j++) {
        const similarity = this.calculateSimilarity(socialAccounts[i], socialAccounts[j]);
        
        if (similarity.similarity > 60) {
          edges.push({
            from: `social_${socialAccounts[i].id}`,
            to: `social_${socialAccounts[j].id}`,
            label: `تشابه: ${similarity.similarity}%`,
            confidence: similarity.similarity,
            dashed: true
          });
        }
      }
    }

    return { nodes, edges };
  }

  // تحليل الأنماط الزمنية
  analyzeTemporalPatterns(personId) {
    const socialAccounts = this.db.getSocialAccounts(personId);
    const patterns = {};

    socialAccounts.forEach(account => {
      if (account.last_post_date) {
        const date = new Date(account.last_post_date);
        const hour = date.getHours();
        
        if (!patterns[hour]) {
          patterns[hour] = 0;
        }
        patterns[hour]++;
      }
    });

    return patterns;
  }

  // تقييم الثقة الإجمالية
  calculateOverallConfidence(personId) {
    const socialAccounts = this.db.getSocialAccounts(personId);
    const breaches = this.db.getBreaches(personId);
    const domains = this.db.getDomains(personId);

    let totalConfidence = 0;
    let count = 0;

    socialAccounts.forEach(account => {
      totalConfidence += account.confidence_score || 0;
      count++;
    });

    breaches.forEach(breach => {
      totalConfidence += breach.verified ? 100 : 50;
      count++;
    });

    domains.forEach(() => {
      totalConfidence += 80;
      count++;
    });

    return count > 0 ? totalConfidence / count : 0;
  }

  // إنشاء تقرير شامل
  generateReport(personId) {
    const person = this.db.getPerson(personId);
    const socialAccounts = this.db.getSocialAccounts(personId);
    const breaches = this.db.getBreaches(personId);
    const domains = this.db.getDomains(personId);
    const logs = this.db.getLogs(personId);
    const graph = this.buildRelationshipGraph(personId);
    const overallConfidence = this.calculateOverallConfidence(personId);

    return {
      person,
      summary: {
        totalSocialAccounts: socialAccounts.length,
        totalBreaches: breaches.length,
        totalDomains: domains.length,
        overallConfidence: Math.round(overallConfidence * 100) / 100,
        confidenceLevel: this.getConfidenceLevel(overallConfidence)
      },
      socialAccounts,
      breaches,
      domains,
      graph,
      logs: logs.slice(0, 50) // آخر 50 سجل
    };
  }
}

module.exports = CorrelationEngine;
