const BaseCollector = require('./baseCollector');

/**
 * StylometryAnalyzer - تحليل أسلوب الكتابة لتحديد هوية الكاتب
 * يستخدم تقنيات متقدمة لتحليل الأنماط اللغوية والأسلوبية
 */
class StylometryAnalyzer extends BaseCollector {
  constructor(db) {
    super('StylometryAnalyzer', db);
  }

  /**
   * تحليل نص وإنشاء بصمة أسلوبية
   */
  async analyzeText(personId, text, source = 'unknown') {
    await this.log(personId, 'INFO', `بدء تحليل أسلوب الكتابة للنص من: ${source}`);
    
    const analysis = {
      source: source,
      text_length: text.length,
      features: {},
      fingerprint: null
    };

    try {
      // استخراج الميزات الأسلوبية
      analysis.features = this.extractStylometricFeatures(text);
      
      // إنشاء بصمة أسلوبية
      analysis.fingerprint = this.createFingerprint(analysis.features);
      
      // حفظ التحليل
      await this.saveAnalysis(personId, analysis);
      
      await this.log(personId, 'SUCCESS', 'تم تحليل أسلوب الكتابة بنجاح');
      
    } catch (error) {
      await this.log(personId, 'ERROR', `خطأ في تحليل الأسلوب: ${error.message}`);
      console.error('Stylometry error:', error);
    }
    
    return analysis;
  }

  /**
   * استخراج الميزات الأسلوبية من النص
   */
  extractStylometricFeatures(text) {
    const features = {};
    
    // 1. ميزات الأحرف
    features.character = this.analyzeCharacters(text);
    
    // 2. ميزات الكلمات
    features.words = this.analyzeWords(text);
    
    // 3. ميزات الجمل
    features.sentences = this.analyzeSentences(text);
    
    // 4. ميزات علامات الترقيم
    features.punctuation = this.analyzePunctuation(text);
    
    // 5. ميزات المفردات
    features.vocabulary = this.analyzeVocabulary(text);
    
    // 6. ميزات الأسلوب
    features.style = this.analyzeStyle(text);
    
    return features;
  }

  /**
   * تحليل الأحرف
   */
  analyzeCharacters(text) {
    const totalChars = text.length;
    const letters = text.match(/[a-zA-Zأ-ي]/g) || [];
    const digits = text.match(/\d/g) || [];
    const spaces = text.match(/\s/g) || [];
    const uppercase = text.match(/[A-Z]/g) || [];
    const lowercase = text.match(/[a-z]/g) || [];
    
    return {
      total: totalChars,
      letters: letters.length,
      digits: digits.length,
      spaces: spaces.length,
      uppercase: uppercase.length,
      lowercase: lowercase.length,
      letter_ratio: letters.length / totalChars,
      digit_ratio: digits.length / totalChars,
      uppercase_ratio: uppercase.length / (uppercase.length + lowercase.length || 1)
    };
  }

  /**
   * تحليل الكلمات
   */
  analyzeWords(text) {
    const words = text.match(/\b\w+\b/g) || [];
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    
    const wordLengths = words.map(w => w.length);
    const avgWordLength = wordLengths.reduce((a, b) => a + b, 0) / (words.length || 1);
    
    // الكلمات القصيرة (1-3 أحرف)
    const shortWords = words.filter(w => w.length <= 3);
    
    // الكلمات الطويلة (7+ أحرف)
    const longWords = words.filter(w => w.length >= 7);
    
    return {
      total: words.length,
      unique: uniqueWords.size,
      unique_ratio: uniqueWords.size / (words.length || 1),
      avg_length: avgWordLength,
      short_words: shortWords.length,
      long_words: longWords.length,
      short_words_ratio: shortWords.length / (words.length || 1),
      long_words_ratio: longWords.length / (words.length || 1)
    };
  }

  /**
   * تحليل الجمل
   */
  analyzeSentences(text) {
    // تقسيم النص إلى جمل (بسيط)
    const sentences = text.split(/[.!?؟]+/).filter(s => s.trim().length > 0);
    
    const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
    const avgSentenceLength = sentenceLengths.reduce((a, b) => a + b, 0) / (sentences.length || 1);
    
    return {
      total: sentences.length,
      avg_length: avgSentenceLength,
      min_length: Math.min(...sentenceLengths),
      max_length: Math.max(...sentenceLengths)
    };
  }

  /**
   * تحليل علامات الترقيم
   */
  analyzePunctuation(text) {
    const commas = (text.match(/,|،/g) || []).length;
    const periods = (text.match(/\.|。/g) || []).length;
    const exclamations = (text.match(/!/g) || []).length;
    const questions = (text.match(/\?|؟/g) || []).length;
    const semicolons = (text.match(/;/g) || []).length;
    const colons = (text.match(/:/g) || []).length;
    const quotes = (text.match(/"|'|"|"|'|'/g) || []).length;
    const dashes = (text.match(/-|–|—/g) || []).length;
    const ellipsis = (text.match(/\.\.\./g) || []).length;
    
    const totalPunctuation = commas + periods + exclamations + questions + 
                            semicolons + colons + quotes + dashes + ellipsis;
    
    return {
      total: totalPunctuation,
      commas: commas,
      periods: periods,
      exclamations: exclamations,
      questions: questions,
      semicolons: semicolons,
      colons: colons,
      quotes: quotes,
      dashes: dashes,
      ellipsis: ellipsis,
      punctuation_density: totalPunctuation / (text.length || 1)
    };
  }

  /**
   * تحليل المفردات
   */
  analyzeVocabulary(text) {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const wordFreq = {};
    
    // حساب تكرار الكلمات
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    // أكثر الكلمات استخداماً
    const sortedWords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    
    // الكلمات الوظيفية (function words)
    const functionWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
                          'من', 'إلى', 'في', 'على', 'عن', 'مع', 'أن', 'هذا', 'التي', 'الذي'];
    
    const functionWordCount = words.filter(w => functionWords.includes(w)).length;
    
    return {
      vocabulary_richness: Object.keys(wordFreq).length / (words.length || 1),
      most_common: sortedWords.slice(0, 10).map(([word, count]) => ({ word, count })),
      function_word_ratio: functionWordCount / (words.length || 1),
      hapax_legomena: Object.values(wordFreq).filter(count => count === 1).length
    };
  }

  /**
   * تحليل الأسلوب
   */
  analyzeStyle(text) {
    // الكلمات الانتقالية
    const transitions = ['however', 'therefore', 'moreover', 'furthermore', 'nevertheless',
                        'لكن', 'ولكن', 'لذلك', 'إذن', 'بالتالي', 'علاوة', 'بالإضافة'];
    
    const transitionCount = transitions.reduce((count, word) => {
      return count + (text.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    }, 0);
    
    // الأفعال المساعدة
    const modalVerbs = ['can', 'could', 'may', 'might', 'must', 'should', 'would',
                       'يمكن', 'قد', 'يجب', 'ينبغي'];
    
    const modalCount = modalVerbs.reduce((count, word) => {
      return count + (text.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    }, 0);
    
    return {
      transition_words: transitionCount,
      modal_verbs: modalCount,
      formality_score: this.calculateFormality(text)
    };
  }

  /**
   * حساب درجة الرسمية
   */
  calculateFormality(text) {
    // خوارزمية بسيطة لحساب الرسمية
    let score = 50; // نقطة البداية
    
    // زيادة الرسمية
    if (text.includes('السيد') || text.includes('السيدة')) score += 10;
    if (text.includes('حضرة') || text.includes('سعادة')) score += 15;
    if (text.match(/\b(يرجى|نأمل|نود|نتشرف)\b/)) score += 10;
    
    // تقليل الرسمية
    if (text.match(/\b(هاي|مرحبا|أهلا|يا|هلا)\b/)) score -= 10;
    if (text.match(/😀|😂|😊|❤️/)) score -= 15;
    if (text.match(/!{2,}/)) score -= 5;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * إنشاء بصمة أسلوبية
   */
  createFingerprint(features) {
    // إنشاء بصمة فريدة من الميزات الأساسية
    const fingerprint = {
      avg_word_length: features.words.avg_length,
      avg_sentence_length: features.sentences.avg_length,
      unique_word_ratio: features.words.unique_ratio,
      punctuation_density: features.punctuation.punctuation_density,
      function_word_ratio: features.vocabulary.function_word_ratio,
      formality: features.style.formality_score
    };
    
    return fingerprint;
  }

  /**
   * مقارنة بصمتين أسلوبيتين
   */
  compareFingerprints(fingerprint1, fingerprint2) {
    const keys = Object.keys(fingerprint1);
    let totalDiff = 0;
    
    keys.forEach(key => {
      const diff = Math.abs(fingerprint1[key] - fingerprint2[key]);
      totalDiff += diff;
    });
    
    // حساب درجة التشابه (0-100)
    const avgDiff = totalDiff / keys.length;
    const similarity = Math.max(0, 100 - (avgDiff * 10));
    
    return {
      similarity: similarity,
      confidence: similarity > 80 ? 'عالي' : similarity > 60 ? 'متوسط' : 'منخفض'
    };
  }

  /**
   * حفظ التحليل
   */
  async saveAnalysis(personId, analysis) {
    this.db.addMetadata(
      personId,
      'stylometry_analysis',
      JSON.stringify({
        source: analysis.source,
        fingerprint: analysis.fingerprint,
        analysis_date: new Date().toISOString()
      })
    );
  }
}

module.exports = StylometryAnalyzer;
