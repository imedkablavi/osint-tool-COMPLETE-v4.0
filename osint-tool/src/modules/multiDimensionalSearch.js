/**
 * Multi-Dimensional Search Engine
 * 
 * محرك بحث متقدم متعدد الأبعاد مع خوارزمية مطابقة احتمالية ذكية
 * يدعم جميع أنواع المعطيات ويحسب درجة التشابه بدقة عالية
 * 
 * @version 3.0.0
 * @author OSINT Tool Team
 */

const BaseCollector = require('./baseCollector');

class MultiDimensionalSearchEngine extends BaseCollector {
  constructor(db, collectors = {}) {
    super(db);
    
    // وحدات البحث المتاحة
    this.collectors = collectors;
    
    // أنواع المعطيات المدعومة
    this.dataTypes = {
      fullName: 'الاسم الكامل',
      firstName: 'الاسم الأول',
      lastName: 'اسم العائلة',
      email: 'البريد الإلكتروني',
      username: 'اسم المستخدم',
      phone: 'رقم الهاتف',
      location: 'الموقع الجغرافي',
      city: 'المدينة',
      country: 'الدولة',
      university: 'الجامعة',
      occupation: 'مجال العمل',
      company: 'الشركة',
      jobTitle: 'المسمى الوظيفي',
      education: 'المؤهل الدراسي',
      skills: 'المهارات',
      interests: 'الاهتمامات',
      birthDate: 'تاريخ الميلاد',
      gender: 'الجنس',
      languages: 'اللغات',
      website: 'الموقع الإلكتروني'
    };
    
    // أوزان المطابقة (0-1)
    this.matchWeights = {
      // معطيات أساسية (وزن عالي)
      email: 0.95,              // البريد الإلكتروني (أقوى معرّف)
      phone: 0.90,              // رقم الهاتف
      username: 0.85,           // اسم المستخدم
      fullName: 0.80,           // الاسم الكامل
      
      // معطيات ثانوية (وزن متوسط)
      firstName: 0.60,          // الاسم الأول
      lastName: 0.65,           // اسم العائلة
      university: 0.70,         // الجامعة
      company: 0.65,            // الشركة
      jobTitle: 0.60,           // المسمى الوظيفي
      
      // معطيات مساعدة (وزن منخفض)
      location: 0.50,           // الموقع
      city: 0.45,               // المدينة
      country: 0.40,            // الدولة
      occupation: 0.55,         // مجال العمل
      education: 0.50,          // المؤهل
      
      // معطيات إضافية (وزن ضعيف)
      skills: 0.35,             // المهارات
      interests: 0.30,          // الاهتمامات
      birthDate: 0.75,          // تاريخ الميلاد (دقيق)
      gender: 0.25,             // الجنس
      languages: 0.30,          // اللغات
      website: 0.70,            // الموقع الإلكتروني
      
      // معطيات شبكية (وزن متغير)
      followers: 0.20,          // عدد المتابعين
      following: 0.15,          // عدد المتابَعين
      posts: 0.25,              // عدد المنشورات
      connections: 0.40,        // الاتصالات المشتركة
      
      // معطيات سلوكية (وزن متوسط)
      writingStyle: 0.55,       // أسلوب الكتابة
      postingTime: 0.35,        // أوقات النشر
      contentType: 0.40         // نوع المحتوى
    };
    
    // عتبات التصنيف
    this.thresholds = {
      strong: 0.75,     // مرشح قوي
      medium: 0.50,     // مرشح متوسط
      weak: 0.30        // مرشح ضعيف
    };
    
    // إحصائيات البحث
    this.searchStats = {
      totalSearches: 0,
      totalCandidates: 0,
      strongMatches: 0,
      mediumMatches: 0,
      weakMatches: 0
    };
  }
  
  /**
   * بحث متعدد الأبعاد
   */
  async search(searchCriteria, options = {}) {
    try {
      const {
        maxCandidates = 100,
        minScore = 0.30,
        enableAllCollectors = true,
        collectorsToUse = [],
        deepSearch = false
      } = options;
      
      console.log('🔍 بدء البحث المتعدد الأبعاد...');
      console.log('📋 المعطيات المدخلة:', this.formatSearchCriteria(searchCriteria));
      
      // المرحلة 1: جمع المرشحين من جميع المصادر
      const candidates = await this.collectCandidates(searchCriteria, {
        enableAllCollectors,
        collectorsToUse,
        deepSearch
      });
      
      console.log(`✅ تم جمع ${candidates.length} مرشح`);
      
      // المرحلة 2: حساب درجة التشابه لكل مرشح
      const scoredCandidates = this.scoreAllCandidates(candidates, searchCriteria);
      
      // المرحلة 3: تصفية وترتيب النتائج
      const filteredCandidates = scoredCandidates
        .filter(c => c.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxCandidates);
      
      // المرحلة 4: تصنيف المرشحين
      const classifiedCandidates = this.classifyCandidates(filteredCandidates);
      
      // المرحلة 5: توليد التقرير
      const report = this.generateReport(searchCriteria, classifiedCandidates);
      
      // تحديث الإحصائيات
      this.updateStats(classifiedCandidates);
      
      console.log('✅ اكتمل البحث');
      console.log(`📊 النتائج: ${classifiedCandidates.strong.length} قوي، ${classifiedCandidates.medium.length} متوسط، ${classifiedCandidates.weak.length} ضعيف`);
      
      return {
        success: true,
        searchCriteria,
        results: classifiedCandidates,
        report,
        stats: this.searchStats
      };
      
    } catch (error) {
      console.error('❌ خطأ في البحث:', error);
      return {
        success: false,
        error: error.message,
        results: { strong: [], medium: [], weak: [] }
      };
    }
  }
  
  /**
   * جمع المرشحين من جميع المصادر
   */
  async collectCandidates(searchCriteria, options) {
    const candidates = [];
    
    // 1. البحث باستخدام Sherlock (أسماء المستخدم)
    if (searchCriteria.username && this.collectors.sherlock) {
      console.log('🔎 البحث في Sherlock...');
      const sherlockResults = await this.collectors.sherlock.search(searchCriteria.username);
      candidates.push(...this.formatSherlockResults(sherlockResults, searchCriteria));
    }
    
    // 2. البحث باستخدام Maigret (بحث معمق)
    if (searchCriteria.username && this.collectors.maigret && options.deepSearch) {
      console.log('🔎 البحث في Maigret...');
      const maigretResults = await this.collectors.maigret.search(searchCriteria.username);
      candidates.push(...this.formatMaigretResults(maigretResults, searchCriteria));
    }
    
    // 3. البحث باستخدام Holehe (البريد الإلكتروني)
    if (searchCriteria.email && this.collectors.holehe) {
      console.log('🔎 البحث في Holehe...');
      const holeheResults = await this.collectors.holehe.search(searchCriteria.email);
      candidates.push(...this.formatHoleheResults(holeheResults, searchCriteria));
    }
    
    // 4. البحث باستخدام HaveIBeenPwned (التسريبات)
    if (searchCriteria.email && this.collectors.hibp) {
      console.log('🔎 البحث في HaveIBeenPwned...');
      const hibpResults = await this.collectors.hibp.search(searchCriteria.email);
      candidates.push(...this.formatHIBPResults(hibpResults, searchCriteria));
    }
    
    // 5. البحث باستخدام Google Dorks
    if (this.collectors.googleDorks) {
      console.log('🔎 البحث في Google Dorks...');
      const dorksResults = await this.collectors.googleDorks.search(null, searchCriteria);
      candidates.push(...this.formatDorksResults(dorksResults, searchCriteria));
    }
    
    // 6. البحث في قاعدة البيانات المحلية
    const localResults = this.searchLocalDatabase(searchCriteria);
    candidates.push(...localResults);
    
    return candidates;
  }
  
  /**
   * حساب درجة التشابه لجميع المرشحين
   */
  scoreAllCandidates(candidates, searchCriteria) {
    return candidates.map(candidate => {
      const score = this.calculateSimilarityScore(candidate, searchCriteria);
      const matches = this.identifyMatches(candidate, searchCriteria);
      
      return {
        ...candidate,
        score: score.total,
        scoreBreakdown: score.breakdown,
        matches,
        matchCount: matches.length
      };
    });
  }
  
  /**
   * حساب درجة التشابه (خوارزمية متعددة الأبعاد)
   */
  calculateSimilarityScore(candidate, searchCriteria) {
    const breakdown = {};
    let totalScore = 0;
    let totalWeight = 0;
    
    // المرور على جميع المعطيات
    for (const [key, value] of Object.entries(searchCriteria)) {
      if (!value || !this.matchWeights[key]) continue;
      
      const candidateValue = candidate[key];
      if (!candidateValue) continue;
      
      // حساب التشابه لهذا المعطى
      const similarity = this.calculateFieldSimilarity(
        value,
        candidateValue,
        key
      );
      
      const weight = this.matchWeights[key];
      const weightedScore = similarity * weight;
      
      breakdown[key] = {
        input: value,
        candidate: candidateValue,
        similarity,
        weight,
        weightedScore
      };
      
      totalScore += weightedScore;
      totalWeight += weight;
    }
    
    // النتيجة النهائية (0-1)
    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    
    return {
      total: Math.round(finalScore * 100) / 100,
      breakdown
    };
  }
  
  /**
   * حساب التشابه لحقل واحد
   */
  calculateFieldSimilarity(value1, value2, fieldType) {
    // تحويل إلى نص صغير
    const v1 = String(value1).toLowerCase().trim();
    const v2 = String(value2).toLowerCase().trim();
    
    // مطابقة تامة
    if (v1 === v2) return 1.0;
    
    // حسب نوع الحقل
    switch (fieldType) {
      case 'email':
      case 'phone':
      case 'username':
        // هذه الحقول تتطلب مطابقة تامة أو شبه تامة
        return this.calculateStringDistance(v1, v2);
      
      case 'fullName':
      case 'firstName':
      case 'lastName':
        // الأسماء: مطابقة جزئية مقبولة
        return this.calculateNameSimilarity(v1, v2);
      
      case 'location':
      case 'city':
      case 'country':
      case 'university':
      case 'company':
        // الأماكن والمؤسسات: مطابقة جزئية
        return this.calculatePartialMatch(v1, v2);
      
      case 'occupation':
      case 'jobTitle':
      case 'education':
        // المهن والتعليم: مطابقة دلالية
        return this.calculateSemanticSimilarity(v1, v2);
      
      case 'skills':
      case 'interests':
      case 'languages':
        // القوائم: مطابقة مجموعات
        return this.calculateSetSimilarity(v1, v2);
      
      case 'birthDate':
        // التاريخ: مطابقة دقيقة
        return v1 === v2 ? 1.0 : 0.0;
      
      default:
        // افتراضي: مطابقة نصية
        return this.calculateStringDistance(v1, v2);
    }
  }
  
  /**
   * حساب المسافة بين نصين (Levenshtein Distance)
   */
  calculateStringDistance(s1, s2) {
    const len1 = s1.length;
    const len2 = s2.length;
    
    if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
    if (len2 === 0) return 0.0;
    
    const matrix = [];
    
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    
    return 1 - (distance / maxLen);
  }
  
  /**
   * حساب تشابه الأسماء
   */
  calculateNameSimilarity(name1, name2) {
    // تقسيم الأسماء
    const parts1 = name1.split(/\s+/);
    const parts2 = name2.split(/\s+/);
    
    // حساب التقاطع
    let matches = 0;
    for (const part1 of parts1) {
      for (const part2 of parts2) {
        if (this.calculateStringDistance(part1, part2) > 0.8) {
          matches++;
          break;
        }
      }
    }
    
    const maxParts = Math.max(parts1.length, parts2.length);
    return matches / maxParts;
  }
  
  /**
   * حساب المطابقة الجزئية
   */
  calculatePartialMatch(s1, s2) {
    // إذا كان أحدهما يحتوي الآخر
    if (s1.includes(s2) || s2.includes(s1)) {
      return 0.8;
    }
    
    // حساب الكلمات المشتركة
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * حساب التشابه الدلالي
   */
  calculateSemanticSimilarity(s1, s2) {
    // قاموس المرادفات المهنية
    const synonyms = {
      'developer': ['programmer', 'engineer', 'coder', 'software engineer'],
      'designer': ['ui designer', 'ux designer', 'graphic designer'],
      'manager': ['director', 'lead', 'head', 'supervisor'],
      'analyst': ['data analyst', 'business analyst', 'researcher']
    };
    
    // البحث عن المرادفات
    for (const [key, values] of Object.entries(synonyms)) {
      if ((s1.includes(key) || values.some(v => s1.includes(v))) &&
          (s2.includes(key) || values.some(v => s2.includes(v)))) {
        return 0.85;
      }
    }
    
    // إذا لم توجد مرادفات، استخدم المطابقة الجزئية
    return this.calculatePartialMatch(s1, s2);
  }
  
  /**
   * حساب تشابه المجموعات (Jaccard Similarity)
   */
  calculateSetSimilarity(s1, s2) {
    const set1 = new Set(s1.split(/[,;]\s*/));
    const set2 = new Set(s2.split(/[,;]\s*/));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * تحديد المطابقات
   */
  identifyMatches(candidate, searchCriteria) {
    const matches = [];
    
    for (const [key, value] of Object.entries(searchCriteria)) {
      if (!value) continue;
      
      const candidateValue = candidate[key];
      if (!candidateValue) continue;
      
      const similarity = this.calculateFieldSimilarity(value, candidateValue, key);
      
      if (similarity >= 0.7) {
        matches.push({
          field: key,
          fieldName: this.dataTypes[key] || key,
          input: value,
          candidate: candidateValue,
          similarity: Math.round(similarity * 100),
          weight: this.matchWeights[key] || 0.5
        });
      }
    }
    
    return matches.sort((a, b) => b.similarity - a.similarity);
  }
  
  /**
   * تصنيف المرشحين
   */
  classifyCandidates(candidates) {
    return {
      strong: candidates.filter(c => c.score >= this.thresholds.strong),
      medium: candidates.filter(c => c.score >= this.thresholds.medium && c.score < this.thresholds.strong),
      weak: candidates.filter(c => c.score >= this.thresholds.weak && c.score < this.thresholds.medium)
    };
  }
  
  /**
   * توليد التقرير
   */
  generateReport(searchCriteria, classifiedCandidates) {
    const { strong, medium, weak } = classifiedCandidates;
    
    return {
      summary: {
        totalCandidates: strong.length + medium.length + weak.length,
        strongMatches: strong.length,
        mediumMatches: medium.length,
        weakMatches: weak.length,
        searchCriteria: this.formatSearchCriteria(searchCriteria)
      },
      topMatches: strong.slice(0, 10).map(c => ({
        platform: c.platform,
        username: c.username,
        score: c.score,
        matchCount: c.matchCount,
        topMatches: c.matches.slice(0, 5)
      })),
      recommendations: this.generateRecommendations(classifiedCandidates, searchCriteria)
    };
  }
  
  /**
   * توليد التوصيات
   */
  generateRecommendations(classifiedCandidates, searchCriteria) {
    const recommendations = [];
    
    if (classifiedCandidates.strong.length === 0) {
      recommendations.push('لم يتم العثور على مطابقات قوية. جرب توسيع معايير البحث.');
    }
    
    if (classifiedCandidates.strong.length > 20) {
      recommendations.push('عدد كبير من المطابقات القوية. جرب تضييق معايير البحث لنتائج أدق.');
    }
    
    // التحقق من المعطيات المفقودة
    const missingFields = [];
    for (const [key, name] of Object.entries(this.dataTypes)) {
      if (!searchCriteria[key] && this.matchWeights[key] > 0.6) {
        missingFields.push(name);
      }
    }
    
    if (missingFields.length > 0) {
      recommendations.push(`إضافة المعطيات التالية قد يحسن النتائج: ${missingFields.join(', ')}`);
    }
    
    return recommendations;
  }
  
  /**
   * تنسيق معايير البحث
   */
  formatSearchCriteria(criteria) {
    const formatted = {};
    for (const [key, value] of Object.entries(criteria)) {
      if (value) {
        formatted[this.dataTypes[key] || key] = value;
      }
    }
    return formatted;
  }
  
  /**
   * تحديث الإحصائيات
   */
  updateStats(classifiedCandidates) {
    this.searchStats.totalSearches++;
    this.searchStats.totalCandidates += classifiedCandidates.strong.length + 
                                         classifiedCandidates.medium.length + 
                                         classifiedCandidates.weak.length;
    this.searchStats.strongMatches += classifiedCandidates.strong.length;
    this.searchStats.mediumMatches += classifiedCandidates.medium.length;
    this.searchStats.weakMatches += classifiedCandidates.weak.length;
  }
  
  /**
   * تنسيق نتائج Sherlock
   */
  formatSherlockResults(results, searchCriteria) {
    if (!results || !results.results) return [];
    
    return results.results.map(r => ({
      source: 'Sherlock',
      platform: r.platform,
      username: searchCriteria.username,
      url: r.url,
      exists: r.exists,
      responseTime: r.responseTime
    }));
  }
  
  /**
   * تنسيق نتائج Maigret
   */
  formatMaigretResults(results, searchCriteria) {
    // مشابه لـ Sherlock
    return this.formatSherlockResults(results, searchCriteria);
  }
  
  /**
   * تنسيق نتائج Holehe
   */
  formatHoleheResults(results, searchCriteria) {
    if (!results || !results.results) return [];
    
    return results.results.map(r => ({
      source: 'Holehe',
      platform: r.platform,
      email: searchCriteria.email,
      exists: r.exists,
      rateLimit: r.rateLimit
    }));
  }
  
  /**
   * تنسيق نتائج HIBP
   */
  formatHIBPResults(results, searchCriteria) {
    if (!results || !results.breaches) return [];
    
    return results.breaches.map(b => ({
      source: 'HaveIBeenPwned',
      platform: b.Name,
      email: searchCriteria.email,
      breachDate: b.BreachDate,
      dataClasses: b.DataClasses
    }));
  }
  
  /**
   * تنسيق نتائج Google Dorks
   */
  formatDorksResults(results, searchCriteria) {
    if (!results || !results.results) return [];
    
    return results.results.map(r => ({
      source: 'Google Dorks',
      platform: r.platform,
      url: r.url,
      title: r.title,
      snippet: r.snippet,
      relevance: r.relevance
    }));
  }
  
  /**
   * البحث في قاعدة البيانات المحلية
   */
  searchLocalDatabase(searchCriteria) {
    const results = [];
    
    try {
      // البحث في جدول الأشخاص
      let query = 'SELECT * FROM persons WHERE 1=1';
      const params = [];
      
      if (searchCriteria.fullName) {
        query += ' AND full_name LIKE ?';
        params.push(`%${searchCriteria.fullName}%`);
      }
      
      if (searchCriteria.email) {
        query += ' AND email LIKE ?';
        params.push(`%${searchCriteria.email}%`);
      }
      
      if (searchCriteria.phone) {
        query += ' AND phone LIKE ?';
        params.push(`%${searchCriteria.phone}%`);
      }
      
      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params);
      
      for (const row of rows) {
        results.push({
          source: 'Local Database',
          ...row
        });
      }
    } catch (error) {
      console.error('خطأ في البحث المحلي:', error.message);
    }
    
    return results;
  }
}

module.exports = MultiDimensionalSearchEngine;
