const BaseCollector = require('./baseCollector');
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * GoogleDorksCollector - نظام Google Dorks متقدم للبحث المتخصص
 * يستخدم استعلامات متقدمة للعثور على معلومات مخفية
 */
class GoogleDorksCollector extends BaseCollector {
  constructor(db) {
    super('GoogleDorksCollector', db);
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    this.delay = 3000; // تأخير بين الطلبات لتجنب الحظر
  }

  /**
   * قوالب Google Dorks المتقدمة
   */
  getDorkTemplates() {
    return {
      // البحث عن البريد الإلكتروني
      email: [
        '"{email}"',
        '"{email}" site:linkedin.com',
        '"{email}" site:facebook.com',
        '"{email}" site:twitter.com',
        '"{email}" site:github.com',
        '"{email}" filetype:pdf',
        '"{email}" filetype:doc',
        '"{email}" filetype:xls',
        '"{email}" inurl:resume OR inurl:cv'
      ],
      
      // البحث عن اسم المستخدم
      username: [
        '"{username}"',
        '"{username}" site:github.com',
        '"{username}" site:stackoverflow.com',
        '"{username}" site:reddit.com',
        '"{username}" site:medium.com',
        '"{username}" site:youtube.com',
        'inurl:"{username}"',
        'intitle:"{username}"'
      ],
      
      // البحث عن الاسم الكامل
      fullname: [
        '"{fullname}"',
        '"{fullname}" site:linkedin.com',
        '"{fullname}" site:facebook.com',
        '"{fullname}" inurl:about',
        '"{fullname}" inurl:profile',
        '"{fullname}" filetype:pdf resume',
        '"{fullname}" "phone" OR "email"',
        '"{fullname}" "address" OR "location"'
      ],
      
      // البحث عن رقم الهاتف
      phone: [
        '"{phone}"',
        '"{phone}" site:truecaller.com',
        '"{phone}" site:whitepages.com',
        '"{phone}" inurl:contact',
        '"{phone}" "name" OR "owner"'
      ],
      
      // البحث عن النطاقات
      domain: [
        'site:{domain}',
        'site:{domain} inurl:admin',
        'site:{domain} inurl:login',
        'site:{domain} filetype:pdf',
        'site:{domain} intitle:index.of',
        'site:{domain} ext:sql OR ext:db',
        'related:{domain}'
      ],
      
      // البحث عن الصور
      images: [
        '"{query}" site:instagram.com',
        '"{query}" site:flickr.com',
        '"{query}" site:pinterest.com',
        '"{query}" filetype:jpg OR filetype:png'
      ],
      
      // البحث عن الوثائق
      documents: [
        '"{query}" filetype:pdf',
        '"{query}" filetype:doc OR filetype:docx',
        '"{query}" filetype:xls OR filetype:xlsx',
        '"{query}" filetype:ppt OR filetype:pptx',
        '"{query}" filetype:txt'
      ],
      
      // البحث عن معلومات حساسة (للتوعية الأمنية فقط)
      sensitive: [
        'site:{domain} intext:"password"',
        'site:{domain} intext:"username"',
        'site:{domain} ext:log',
        'site:{domain} inurl:backup',
        'site:{domain} intitle:"index of" "config"'
      ]
    };
  }

  /**
   * جمع البيانات باستخدام Google Dorks
   */
  async collect(personId, searchData) {
    await this.log(personId, 'INFO', 'بدء البحث المتقدم باستخدام Google Dorks');
    
    const results = [];
    const dorks = this.buildDorks(searchData);
    
    try {
      await this.log(personId, 'INFO', `تم إنشاء ${dorks.length} استعلام متقدم`);
      
      for (const dork of dorks) {
        try {
          await this.log(personId, 'INFO', `تنفيذ: ${dork.query}`);
          
          const searchResults = await this.executeGoogleSearch(dork.query);
          
          for (const result of searchResults) {
            results.push({
              category: dork.category,
              query: dork.query,
              title: result.title,
              url: result.url,
              snippet: result.snippet,
              discovery_date: new Date().toISOString()
            });
          }
          
          // تأخير بين الطلبات
          await this.sleep(this.delay);
          
        } catch (error) {
          await this.log(personId, 'WARNING', `فشل تنفيذ: ${dork.query} - ${error.message}`);
        }
      }
      
      // حفظ النتائج في قاعدة البيانات
      await this.saveResults(personId, results);
      
      await this.log(personId, 'SUCCESS', `تم العثور على ${results.length} نتيجة عبر Google Dorks`);
      
    } catch (error) {
      await this.log(personId, 'ERROR', `خطأ في Google Dorks: ${error.message}`);
      console.error('Google Dorks error:', error);
    }
    
    return results;
  }

  /**
   * بناء استعلامات Dorks بناءً على البيانات المتوفرة
   */
  buildDorks(searchData) {
    const dorks = [];
    const templates = this.getDorkTemplates();
    
    // استعلامات البريد الإلكتروني
    if (searchData.email) {
      for (const template of templates.email) {
        dorks.push({
          category: 'email',
          query: template.replace('{email}', searchData.email)
        });
      }
    }
    
    // استعلامات اسم المستخدم
    if (searchData.username) {
      for (const template of templates.username) {
        dorks.push({
          category: 'username',
          query: template.replace('{username}', searchData.username)
        });
      }
    }
    
    // استعلامات الاسم الكامل
    if (searchData.fullname) {
      for (const template of templates.fullname) {
        dorks.push({
          category: 'fullname',
          query: template.replace('{fullname}', searchData.fullname)
        });
      }
    }
    
    // استعلامات رقم الهاتف
    if (searchData.phone) {
      for (const template of templates.phone) {
        dorks.push({
          category: 'phone',
          query: template.replace('{phone}', searchData.phone)
        });
      }
    }
    
    return dorks;
  }

  /**
   * تنفيذ بحث Google (باستخدام scraping بسيط)
   */
  async executeGoogleSearch(query) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://www.google.com/search?q=${encodedQuery}&num=10`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ar,en;q=0.9'
        },
        timeout: 15000
      });
      
      return this.parseGoogleResults(response.data);
      
    } catch (error) {
      console.error('Google search error:', error.message);
      return [];
    }
  }

  /**
   * تحليل نتائج Google
   */
  parseGoogleResults(html) {
    const results = [];
    const $ = cheerio.load(html);
    
    // Google يستخدم div.g لكل نتيجة
    $('div.g').each((i, elem) => {
      const title = $(elem).find('h3').text();
      const url = $(elem).find('a').attr('href');
      const snippet = $(elem).find('.VwiC3b').text() || $(elem).find('.IsZvec').text();
      
      if (title && url) {
        results.push({
          title: title.trim(),
          url: url,
          snippet: snippet.trim()
        });
      }
    });
    
    return results;
  }

  /**
   * حفظ النتائج في قاعدة البيانات
   */
  async saveResults(personId, results) {
    for (const result of results) {
      // حفظ كـ metadata
      this.db.addMetadata(
        personId,
        'google_dork_result',
        JSON.stringify(result)
      );
    }
  }

  /**
   * تأخير (sleep)
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * استعلامات مخصصة
   */
  async customDork(query) {
    return await this.executeGoogleSearch(query);
  }
}

module.exports = GoogleDorksCollector;
