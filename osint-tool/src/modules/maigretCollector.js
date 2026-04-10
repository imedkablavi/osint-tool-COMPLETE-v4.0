const BaseCollector = require('./baseCollector');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * MaigretCollector - دمج حقيقي مع أداة Maigret للبحث في 3000+ موقع
 * Maigret هو نسخة موسعة من Sherlock مع قدرات استخراج إضافية
 */
class MaigretCollector extends BaseCollector {
  constructor(db) {
    super('MaigretCollector', db);
    this.tempDir = path.join(__dirname, '../../temp');
    
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * جمع البيانات باستخدام Maigret
   */
  async collect(personId, searchData) {
    await this.log(personId, 'INFO', 'بدء البحث المتقدم باستخدام Maigret');
    
    const results = [];
    const username = searchData.username;
    
    if (!username) {
      await this.log(personId, 'WARNING', 'لا يوجد اسم مستخدم للبحث');
      return results;
    }

    try {
      await this.log(personId, 'INFO', `البحث المعمق عن: ${username} في 3000+ موقع (قد يستغرق عدة دقائق)`);
      
      // تشغيل Maigret مع خيارات متقدمة
      const maigretResults = await this.runMaigret(username);
      
      // معالجة النتائج المتقدمة
      for (const account of maigretResults) {
        const accountData = {
          platform: account.site_name,
          username: username,
          profile_url: account.url,
          confidence_score: account.confidence || 80,
          additional_data: JSON.stringify({
            source: 'Maigret',
            extracted_info: account.extracted_info || {},
            tags: account.tags || [],
            discovery_date: new Date().toISOString()
          })
        };
        
        // حفظ في قاعدة البيانات
        const result = this.db.addSocialAccount(
          personId,
          accountData.platform,
          accountData.username,
          accountData.profile_url,
          accountData.confidence_score,
          accountData.additional_data
        );
        
        results.push({
          id: result.lastInsertRowid,
          ...accountData
        });
      }
      
      await this.log(personId, 'SUCCESS', `تم العثور على ${results.length} حساب عبر Maigret`);
      
    } catch (error) {
      await this.log(personId, 'ERROR', `خطأ في Maigret: ${error.message}`);
      console.error('Maigret error:', error);
    }
    
    return results;
  }

  /**
   * تشغيل Maigret كعملية فرعية
   */
  async runMaigret(username) {
    return new Promise((resolve, reject) => {
      const outputFile = path.join(this.tempDir, `maigret_${username}_${Date.now()}.json`);
      
      // Maigret مع خيارات متقدمة
      // --top-sites: البحث في أشهر 500 موقع (أسرع)
      // --json: تصدير بصيغة JSON
      // --timeout: مهلة الانتظار لكل موقع
      const command = `maigret ${username} --json simple --timeout 15 --retries 2 --folderoutput ${this.tempDir} 2>&1`;
      
      exec(command, { 
        maxBuffer: 20 * 1024 * 1024,
        timeout: 300000 // 5 دقائق كحد أقصى
      }, (error, stdout, stderr) => {
        const results = [];
        
        try {
          // البحث عن ملف JSON الناتج
          const files = fs.readdirSync(this.tempDir);
          const jsonFile = files.find(f => f.startsWith(`report_${username}`) && f.endsWith('.json'));
          
          if (jsonFile) {
            const filePath = path.join(this.tempDir, jsonFile);
            const data = fs.readFileSync(filePath, 'utf8');
            const jsonData = JSON.parse(data);
            
            // استخراج الحسابات المكتشفة
            for (const [siteName, siteData] of Object.entries(jsonData)) {
              if (siteData.status === 'found' || siteData.status === 'exists') {
                results.push({
                  site_name: siteName,
                  url: siteData.url || siteData.url_user,
                  confidence: this.calculateConfidence(siteData),
                  extracted_info: siteData.extracted || {},
                  tags: siteData.tags || []
                });
              }
            }
            
            // حذف الملف المؤقت
            fs.unlinkSync(filePath);
          } else {
            // تحليل stdout إذا لم يتم إنشاء JSON
            const lines = stdout.split('\n');
            for (const line of lines) {
              // Maigret يطبع: [+] Site: URL
              const match = line.match(/\[\+\]\s+([^:]+):\s+(https?:\/\/[^\s]+)/);
              if (match) {
                results.push({
                  site_name: match[1].trim(),
                  url: match[2].trim(),
                  confidence: 75,
                  extracted_info: {},
                  tags: []
                });
              }
            }
          }
          
          resolve(results);
        } catch (parseError) {
          console.error('Error parsing Maigret output:', parseError);
          resolve(results);
        }
      });
    });
  }

  /**
   * حساب مستوى الثقة بناءً على البيانات المستخرجة
   */
  calculateConfidence(siteData) {
    let confidence = 70; // قيمة أساسية
    
    // زيادة الثقة إذا كانت هناك بيانات مستخرجة
    if (siteData.extracted && Object.keys(siteData.extracted).length > 0) {
      confidence += 10;
    }
    
    // زيادة الثقة إذا كان هناك اسم حقيقي
    if (siteData.extracted && siteData.extracted.fullname) {
      confidence += 10;
    }
    
    // زيادة الثقة إذا كان هناك موقع جغرافي
    if (siteData.extracted && siteData.extracted.location) {
      confidence += 5;
    }
    
    return Math.min(confidence, 95); // الحد الأقصى 95%
  }

  /**
   * البحث المتكرر (Recursive) - يبحث عن معرفات جديدة في الصفحات المكتشفة
   */
  async recursiveSearch(username, depth = 1) {
    return new Promise((resolve, reject) => {
      const command = `maigret ${username} --top-sites --recursive --depth ${depth} --timeout 20`;
      
      exec(command, { 
        maxBuffer: 30 * 1024 * 1024,
        timeout: 600000 // 10 دقائق
      }, (error, stdout, stderr) => {
        // معالجة النتائج المتكررة
        const results = [];
        // ... (نفس منطق المعالجة)
        resolve(results);
      });
    });
  }
}

module.exports = MaigretCollector;
