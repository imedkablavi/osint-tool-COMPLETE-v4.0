/**
 * Advanced Google Dorks Engine
 * 
 * نظام متقدم لتوليد واستخدام Google Dorks بشكل احترافي
 * يدعم جميع العوامل المتقدمة والخوارزميات الذكية
 * 
 * @version 2.1.0
 * @author OSINT Tool Team
 */

const axios = require('axios');
const cheerio = require('cheerio');
const BaseCollector = require('./baseCollector');

class AdvancedGoogleDorksEngine extends BaseCollector {
  constructor(db, proxyManager = null, cacheManager = null) {
    super(db, proxyManager, cacheManager);
    
    // عوامل البحث المتقدمة
    this.operators = {
      site: 'site:',           // البحث داخل موقع محدد
      filetype: 'filetype:',   // نوع الملف
      ext: 'ext:',             // امتداد الملف (مرادف لـ filetype)
      intitle: 'intitle:',     // في العنوان
      allintitle: 'allintitle:', // جميع الكلمات في العنوان
      inurl: 'inurl:',         // في الرابط
      allinurl: 'allinurl:',   // جميع الكلمات في الرابط
      intext: 'intext:',       // في النص
      allintext: 'allintext:', // جميع الكلمات في النص
      inanchor: 'inanchor:',   // في نص الرابط
      cache: 'cache:',         // النسخة المخبأة
      related: 'related:',     // مواقع مشابهة
      info: 'info:',           // معلومات عن الموقع
      link: 'link:',           // روابط تشير للموقع
    };
    
    // المنصات المستهدفة
    this.platforms = {
      social: [
        'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
        'tiktok.com', 'snapchat.com', 'pinterest.com', 'reddit.com',
        'youtube.com', 'vimeo.com', 'tumblr.com', 'flickr.com'
      ],
      professional: [
        'linkedin.com', 'github.com', 'stackoverflow.com', 'medium.com',
        'behance.net', 'dribbble.com', 'deviantart.com'
      ],
      documents: [
        'scribd.com', 'slideshare.net', 'issuu.com', 'academia.edu'
      ],
      leaks: [
        'pastebin.com', 'ghostbin.com', 'paste.ee', 'hastebin.com',
        'dpaste.com', 'ideone.com', 'codepad.org'
      ],
      forums: [
        'reddit.com', 'quora.com', 'stackexchange.com', 'disqus.com'
      ]
    };
    
    // أنواع الملفات المستهدفة
    this.fileTypes = {
      documents: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'],
      spreadsheets: ['xls', 'xlsx', 'csv', 'ods'],
      presentations: ['ppt', 'pptx', 'odp'],
      archives: ['zip', 'rar', '7z', 'tar', 'gz'],
      code: ['js', 'py', 'java', 'cpp', 'php', 'sql'],
      config: ['xml', 'json', 'yaml', 'yml', 'conf', 'ini']
    };
    
    // قوالب الاستعلامات الذكية
    this.queryTemplates = this.initializeQueryTemplates();
  }
  
  /**
   * تهيئة قوالب الاستعلامات الذكية
   */
  initializeQueryTemplates() {
    return {
      // قوالب البحث عن الأشخاص
      person: {
        basic: [
          '"{fullName}"',
          '"{fullName}" "{location}"',
          '"{fullName}" "{occupation}"',
          '"{firstName}" "{lastName}"'
        ],
        social: [
          'site:{platform} "{fullName}"',
          'site:{platform} "{username}"',
          'site:{platform} inurl:{username}',
          'site:{platform} intitle:"{fullName}"'
        ],
        professional: [
          'site:linkedin.com "{fullName}"',
          'site:github.com "{username}"',
          'site:stackoverflow.com "{username}"',
          '"{fullName}" (CV OR resume) filetype:pdf'
        ],
        contact: [
          '"{fullName}" (email OR contact)',
          '"{fullName}" "@" (gmail OR yahoo OR hotmail)',
          '"{fullName}" phone number',
          '"{fullName}" address'
        ]
      },
      
      // قوالب البحث عن البريد الإلكتروني
      email: {
        direct: [
          '"{email}"',
          'intext:"{email}"',
          'inurl:"{email}"'
        ],
        leaks: [
          'site:pastebin.com "{email}"',
          'site:ghostbin.com "{email}"',
          '"{email}" (leak OR breach OR dump)',
          '"{email}" (password OR credentials)'
        ],
        profiles: [
          '"{email}" site:{platform}',
          '"{email}" (profile OR account)',
          '"{email}" (registered OR signup)'
        ],
        documents: [
          '"{email}" filetype:pdf',
          '"{email}" filetype:xlsx',
          '"{email}" filetype:docx',
          '"{email}" (invoice OR receipt OR contract)'
        ],
        wildcard: [
          '"{emailPrefix}"*{domain}',
          '"{emailPrefix}"*@*',
          '*@{domain}'
        ]
      },
      
      // قوالب البحث عن اسم المستخدم
      username: {
        basic: [
          '"{username}"',
          'inurl:"{username}"',
          'intitle:"{username}"'
        ],
        social: [
          'site:{platform} "{username}"',
          'site:{platform} inurl:{username}',
          'site:{platform}/u/{username}',
          'site:{platform}/user/{username}'
        ],
        code: [
          'site:github.com "{username}"',
          'site:gitlab.com "{username}"',
          'site:bitbucket.org "{username}"'
        ],
        gaming: [
          'site:steamcommunity.com "{username}"',
          'site:twitch.tv "{username}"',
          'site:discord.com "{username}"'
        ]
      },
      
      // قوالب البحث عن رقم الهاتف
      phone: {
        direct: [
          '"{phone}"',
          'intext:"{phone}"',
          '"{phoneFormatted}"'
        ],
        social: [
          'site:facebook.com "{phone}"',
          'site:linkedin.com "{phone}"',
          'site:twitter.com "{phone}"'
        ],
        business: [
          '"{phone}" (business OR company)',
          '"{phone}" (contact OR office)',
          '"{phone}" address'
        ],
        documents: [
          '"{phone}" filetype:pdf',
          '"{phone}" (invoice OR receipt)',
          '"{phone}" (CV OR resume)'
        ]
      },
      
      // قوالب البحث المتقدم
      advanced: {
        combinations: [
          '("{term1}" OR "{term2}") AND "{term3}"',
          '"{term1}" AND "{term2}" -"{exclude}"',
          '("{term1}" | "{term2}") "{term3}"'
        ],
        temporal: [
          '"{term}" after:{year}',
          '"{term}" before:{year}',
          '"{term}" {year}..{year}'
        ],
        specific: [
          'allintitle: {terms}',
          'allinurl: {terms}',
          'allintext: {terms}'
        ]
      }
    };
  }
  
  /**
   * توليد استعلامات ذكية بناءً على البيانات المتاحة
   */
  generateSmartQueries(personData) {
    const queries = [];
    const { fullName, firstName, lastName, email, username, phone, location, occupation } = personData;
    
    // 1. استعلامات البحث الأساسية
    if (fullName) {
      queries.push(...this.generatePersonQueries(fullName, firstName, lastName, location, occupation));
    }
    
    // 2. استعلامات البريد الإلكتروني
    if (email) {
      queries.push(...this.generateEmailQueries(email));
    }
    
    // 3. استعلامات اسم المستخدم
    if (username) {
      queries.push(...this.generateUsernameQueries(username));
    }
    
    // 4. استعلامات رقم الهاتف
    if (phone) {
      queries.push(...this.generatePhoneQueries(phone));
    }
    
    // 5. استعلامات مركبة
    queries.push(...this.generateCombinedQueries(personData));
    
    // إزالة التكرارات وترتيب حسب الأولوية
    return this.prioritizeQueries([...new Set(queries)]);
  }
  
  /**
   * توليد استعلامات البحث عن الأشخاص
   */
  generatePersonQueries(fullName, firstName, lastName, location, occupation) {
    const queries = [];
    
    // استعلامات أساسية
    queries.push(`"${fullName}"`);
    
    if (location) {
      queries.push(`"${fullName}" "${location}"`);
      queries.push(`"${fullName}" AND "${location}"`);
    }
    
    if (occupation) {
      queries.push(`"${fullName}" "${occupation}"`);
      queries.push(`"${fullName}" AND "${occupation}"`);
    }
    
    // البحث في المنصات الاجتماعية
    for (const platform of this.platforms.social) {
      queries.push(`site:${platform} "${fullName}"`);
      queries.push(`site:${platform} intitle:"${fullName}"`);
    }
    
    // البحث في المنصات المهنية
    for (const platform of this.platforms.professional) {
      queries.push(`site:${platform} "${fullName}"`);
    }
    
    // البحث عن السيرة الذاتية والوثائق
    queries.push(`"${fullName}" (CV OR resume) filetype:pdf`);
    queries.push(`"${fullName}" filetype:pdf`);
    queries.push(`"${fullName}" filetype:docx`);
    
    // البحث عن معلومات الاتصال
    queries.push(`"${fullName}" (email OR contact)`);
    queries.push(`"${fullName}" phone`);
    queries.push(`"${fullName}" address`);
    
    // استعلامات مركبة
    if (firstName && lastName) {
      queries.push(`"${firstName}" "${lastName}"`);
      queries.push(`"${firstName}" AND "${lastName}"`);
      
      if (location) {
        queries.push(`"${firstName}" "${lastName}" "${location}"`);
      }
    }
    
    return queries;
  }
  
  /**
   * توليد استعلامات البريد الإلكتروني
   */
  generateEmailQueries(email) {
    const queries = [];
    const [emailPrefix, domain] = email.split('@');
    
    // استعلامات مباشرة
    queries.push(`"${email}"`);
    queries.push(`intext:"${email}"`);
    queries.push(`inurl:"${email}"`);
    
    // البحث في مواقع التسريبات
    for (const leakSite of this.platforms.leaks) {
      queries.push(`site:${leakSite} "${email}"`);
    }
    
    // البحث عن التسريبات
    queries.push(`"${email}" (leak OR breach OR dump)`);
    queries.push(`"${email}" (password OR credentials)`);
    queries.push(`"${email}" (database OR db)`);
    
    // البحث في المنصات الاجتماعية
    for (const platform of this.platforms.social) {
      queries.push(`site:${platform} "${email}"`);
    }
    
    // البحث في الوثائق
    for (const fileType of this.fileTypes.documents) {
      queries.push(`"${email}" filetype:${fileType}`);
    }
    
    // استعلامات Wildcard
    queries.push(`"${emailPrefix}"*@${domain}`);
    queries.push(`"${emailPrefix}"*@*`);
    queries.push(`*@${domain}`);
    
    // البحث عن الحسابات والتسجيلات
    queries.push(`"${email}" (profile OR account)`);
    queries.push(`"${email}" (registered OR signup OR registration)`);
    
    // البحث في GitHub وCode repositories
    queries.push(`site:github.com "${email}"`);
    queries.push(`site:gitlab.com "${email}"`);
    
    return queries;
  }
  
  /**
   * توليد استعلامات اسم المستخدم
   */
  generateUsernameQueries(username) {
    const queries = [];
    
    // استعلامات أساسية
    queries.push(`"${username}"`);
    queries.push(`inurl:"${username}"`);
    queries.push(`intitle:"${username}"`);
    
    // البحث في جميع المنصات الاجتماعية
    for (const platform of this.platforms.social) {
      queries.push(`site:${platform} "${username}"`);
      queries.push(`site:${platform} inurl:${username}`);
      queries.push(`site:${platform}/u/${username}`);
      queries.push(`site:${platform}/user/${username}`);
      queries.push(`site:${platform}/@${username}`);
    }
    
    // البحث في منصات الكود
    queries.push(`site:github.com "${username}"`);
    queries.push(`site:github.com/${username}`);
    queries.push(`site:gitlab.com "${username}"`);
    queries.push(`site:bitbucket.org "${username}"`);
    
    // البحث في المنتديات
    for (const forum of this.platforms.forums) {
      queries.push(`site:${forum} "${username}"`);
    }
    
    // البحث في منصات الألعاب
    queries.push(`site:steamcommunity.com "${username}"`);
    queries.push(`site:twitch.tv "${username}"`);
    queries.push(`site:discord.com "${username}"`);
    
    // البحث عن الملفات الشخصية
    queries.push(`"${username}" (profile OR account)`);
    queries.push(`"${username}" (user OR member)`);
    
    return queries;
  }
  
  /**
   * توليد استعلامات رقم الهاتف
   */
  generatePhoneQueries(phone) {
    const queries = [];
    
    // تنسيقات مختلفة لرقم الهاتف
    const formats = this.formatPhoneNumber(phone);
    
    for (const format of formats) {
      // استعلامات مباشرة
      queries.push(`"${format}"`);
      queries.push(`intext:"${format}"`);
      
      // البحث في المنصات الاجتماعية
      for (const platform of this.platforms.social) {
        queries.push(`site:${platform} "${format}"`);
      }
      
      // البحث في الوثائق
      queries.push(`"${format}" filetype:pdf`);
      queries.push(`"${format}" (CV OR resume)`);
      
      // البحث عن معلومات الأعمال
      queries.push(`"${format}" (business OR company)`);
      queries.push(`"${format}" (contact OR office)`);
      queries.push(`"${format}" address`);
    }
    
    return queries;
  }
  
  /**
   * توليد استعلامات مركبة
   */
  generateCombinedQueries(personData) {
    const queries = [];
    const { fullName, email, username, phone, location } = personData;
    
    // دمج الاسم مع البريد
    if (fullName && email) {
      queries.push(`"${fullName}" AND "${email}"`);
      queries.push(`("${fullName}" OR "${email}")`);
    }
    
    // دمج الاسم مع اسم المستخدم
    if (fullName && username) {
      queries.push(`"${fullName}" AND "${username}"`);
      queries.push(`("${fullName}" OR "${username}")`);
    }
    
    // دمج البريد مع اسم المستخدم
    if (email && username) {
      queries.push(`"${email}" AND "${username}"`);
      queries.push(`("${email}" OR "${username}")`);
    }
    
    // دمج مع الموقع
    if (location) {
      if (fullName) queries.push(`"${fullName}" AND "${location}"`);
      if (email) queries.push(`"${email}" AND "${location}"`);
      if (username) queries.push(`"${username}" AND "${location}"`);
    }
    
    // استعلامات معقدة
    if (fullName && email && location) {
      queries.push(`"${fullName}" AND "${email}" AND "${location}"`);
      queries.push(`("${fullName}" OR "${email}") AND "${location}"`);
    }
    
    // استبعاد نتائج غير مرغوبة
    if (fullName) {
      queries.push(`"${fullName}" -site:linkedin.com`);
      queries.push(`"${fullName}" -site:facebook.com`);
    }
    
    return queries;
  }
  
  /**
   * تنسيق رقم الهاتف بأشكال مختلفة
   */
  formatPhoneNumber(phone) {
    const formats = [phone];
    
    // إزالة جميع الأحرف غير الرقمية
    const digitsOnly = phone.replace(/\D/g, '');
    
    if (digitsOnly.length >= 10) {
      // تنسيقات مختلفة
      formats.push(digitsOnly);
      formats.push(`+${digitsOnly}`);
      formats.push(`(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`);
      formats.push(`${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`);
      formats.push(`${digitsOnly.slice(0, 3)}.${digitsOnly.slice(3, 6)}.${digitsOnly.slice(6)}`);
    }
    
    return [...new Set(formats)];
  }
  
  /**
   * ترتيب الاستعلامات حسب الأولوية
   */
  prioritizeQueries(queries) {
    const prioritized = [];
    
    // الأولوية 1: استعلامات مباشرة
    prioritized.push(...queries.filter(q => !q.includes('site:') && !q.includes('filetype:')));
    
    // الأولوية 2: البحث في المنصات الاجتماعية
    prioritized.push(...queries.filter(q => q.includes('site:') && this.platforms.social.some(p => q.includes(p))));
    
    // الأولوية 3: البحث في مواقع التسريبات
    prioritized.push(...queries.filter(q => q.includes('site:') && this.platforms.leaks.some(p => q.includes(p))));
    
    // الأولوية 4: البحث في الوثائق
    prioritized.push(...queries.filter(q => q.includes('filetype:')));
    
    // الأولوية 5: باقي الاستعلامات
    prioritized.push(...queries.filter(q => !prioritized.includes(q)));
    
    return [...new Set(prioritized)];
  }
  
  /**
   * تنفيذ البحث باستخدام Google Dorks
   */
  async search(personId, personData, options = {}) {
    try {
      const {
        maxQueries = 50,
        maxResultsPerQuery = 10,
        delay = 2000,
        useProxy = false
      } = options;
      
      console.log(`🔍 بدء البحث المتقدم باستخدام Google Dorks...`);
      
      // توليد الاستعلامات الذكية
      const allQueries = this.generateSmartQueries(personData);
      const queries = allQueries.slice(0, maxQueries);
      
      console.log(`📋 تم توليد ${queries.length} استعلام ذكي`);
      
      const results = [];
      let processedQueries = 0;
      
      for (const query of queries) {
        try {
          console.log(`🔎 تنفيذ: ${query}`);
          
          // تنفيذ البحث
          const searchResults = await this.executeGoogleSearch(query, maxResultsPerQuery, useProxy);
          
          // تحليل النتائج
          const analyzedResults = this.analyzeResults(searchResults, query, personData);
          
          results.push(...analyzedResults);
          processedQueries++;
          
          // حفظ في قاعدة البيانات
          for (const result of analyzedResults) {
            this.saveResult(personId, result);
          }
          
          // تأخير لتجنب الحظر
          if (processedQueries < queries.length) {
            await this.sleep(delay);
          }
          
        } catch (error) {
          console.error(`❌ خطأ في الاستعلام "${query}":`, error.message);
        }
      }
      
      console.log(`✅ اكتمل البحث: ${results.length} نتيجة من ${processedQueries} استعلام`);
      
      return {
        success: true,
        totalQueries: processedQueries,
        totalResults: results.length,
        results: results
      };
      
    } catch (error) {
      console.error('❌ خطأ في البحث:', error);
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }
  
  /**
   * تنفيذ بحث Google
   */
  async executeGoogleSearch(query, maxResults = 10, useProxy = false) {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.google.com/search?q=${encodedQuery}&num=${maxResults}`;
    
    const config = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };
    
    if (useProxy && this.proxyManager) {
      config.httpsAgent = this.proxyManager.getAgent();
    }
    
    const response = await axios.get(url, config);
    return this.parseGoogleResults(response.data, query);
  }
  
  /**
   * تحليل نتائج Google
   */
  parseGoogleResults(html, query) {
    const $ = cheerio.load(html);
    const results = [];
    
    // استخراج النتائج
    $('.g').each((i, elem) => {
      const title = $(elem).find('h3').text();
      const link = $(elem).find('a').attr('href');
      const snippet = $(elem).find('.VwiC3b').text();
      
      if (title && link) {
        results.push({
          title,
          url: link,
          snippet,
          query
        });
      }
    });
    
    return results;
  }
  
  /**
   * تحليل النتائج
   */
  analyzeResults(searchResults, query, personData) {
    return searchResults.map(result => {
      const analysis = {
        ...result,
        category: this.categorizeResult(result.url),
        relevance: this.calculateRelevance(result, personData),
        platform: this.extractPlatform(result.url),
        fileType: this.extractFileType(result.url),
        timestamp: new Date().toISOString()
      };
      
      return analysis;
    });
  }
  
  /**
   * تصنيف النتيجة
   */
  categorizeResult(url) {
    if (this.platforms.social.some(p => url.includes(p))) return 'social_media';
    if (this.platforms.professional.some(p => url.includes(p))) return 'professional';
    if (this.platforms.leaks.some(p => url.includes(p))) return 'leak';
    if (this.platforms.forums.some(p => url.includes(p))) return 'forum';
    if (url.includes('.pdf') || url.includes('.doc')) return 'document';
    return 'other';
  }
  
  /**
   * حساب مدى الصلة
   */
  calculateRelevance(result, personData) {
    let score = 0;
    const text = `${result.title} ${result.snippet}`.toLowerCase();
    
    if (personData.fullName && text.includes(personData.fullName.toLowerCase())) score += 3;
    if (personData.email && text.includes(personData.email.toLowerCase())) score += 3;
    if (personData.username && text.includes(personData.username.toLowerCase())) score += 2;
    if (personData.phone && text.includes(personData.phone)) score += 2;
    if (personData.location && text.includes(personData.location.toLowerCase())) score += 1;
    
    return Math.min(score, 10);
  }
  
  /**
   * استخراج المنصة
   */
  extractPlatform(url) {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain;
    } catch {
      return 'unknown';
    }
  }
  
  /**
   * استخراج نوع الملف
   */
  extractFileType(url) {
    const match = url.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
    return match ? match[1] : null;
  }
  
  /**
   * حفظ النتيجة في قاعدة البيانات
   */
  saveResult(personId, result) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO google_dorks_results (
          person_id, query, title, url, snippet, category, 
          relevance, platform, file_type, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        personId,
        result.query,
        result.title,
        result.url,
        result.snippet,
        result.category,
        result.relevance,
        result.platform,
        result.fileType,
        result.timestamp
      );
    } catch (error) {
      // إذا لم يكن الجدول موجوداً، أنشئه
      this.createResultsTable();
      this.saveResult(personId, result);
    }
  }
  
  /**
   * إنشاء جدول النتائج
   */
  createResultsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS google_dorks_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL,
        query TEXT NOT NULL,
        title TEXT,
        url TEXT NOT NULL,
        snippet TEXT,
        category TEXT,
        relevance INTEGER,
        platform TEXT,
        file_type TEXT,
        timestamp TEXT,
        FOREIGN KEY (person_id) REFERENCES persons(id)
      )
    `);
  }
  
  /**
   * تأخير
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AdvancedGoogleDorksEngine;
