const BaseCollector = require('./baseCollector');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * SherlockCollector - دمج حقيقي مع أداة Sherlock للبحث في 400+ موقع
 * يستخدم Sherlock المثبت عبر pip
 */
class SherlockCollector extends BaseCollector {
  constructor(db) {
    super('SherlockCollector', db);
    this.tempDir = path.join(__dirname, '../../temp');
    
    // إنشاء مجلد مؤقت إذا لم يكن موجوداً
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * جمع البيانات باستخدام Sherlock
   */
  async collect(personId, searchData) {
    await this.log(personId, 'INFO', 'بدء البحث باستخدام Sherlock');
    
    const results = [];
    const username = searchData.username;
    
    if (!username) {
      await this.log(personId, 'WARNING', 'لا يوجد اسم مستخدم للبحث');
      return results;
    }

    try {
      // تشغيل Sherlock
      await this.log(personId, 'INFO', `البحث عن اسم المستخدم: ${username} في 400+ موقع`);
      
      const sherlockResults = await this.runSherlock(username);
      
      // معالجة النتائج
      for (const [platform, url] of Object.entries(sherlockResults)) {
        const accountData = {
          platform: platform,
          username: username,
          profile_url: url,
          confidence_score: 85, // Sherlock موثوق جداً
          additional_data: JSON.stringify({
            source: 'Sherlock',
            verified: true,
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
      
      await this.log(personId, 'SUCCESS', `تم العثور على ${results.length} حساب عبر Sherlock`);
      
    } catch (error) {
      await this.log(personId, 'ERROR', `خطأ في Sherlock: ${error.message}`);
      console.error('Sherlock error:', error);
    }
    
    return results;
  }

  /**
   * تشغيل Sherlock كعملية فرعية
   */
  async runSherlock(username) {
    return new Promise((resolve, reject) => {
      const outputFile = path.join(this.tempDir, `sherlock_${username}_${Date.now()}.json`);
      
      // تشغيل Sherlock مع تصدير JSON
      const command = `sherlock ${username} --json --output ${outputFile} --timeout 10 --print-found 2>&1`;
      
      exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        // Sherlock قد يُرجع خطأ حتى لو نجح جزئياً
        const results = {};
        
        try {
          // محاولة قراءة ملف JSON
          if (fs.existsSync(outputFile)) {
            const data = fs.readFileSync(outputFile, 'utf8');
            const jsonData = JSON.parse(data);
            
            // استخراج الحسابات المكتشفة
            for (const [platform, info] of Object.entries(jsonData)) {
              if (info.url_user && info.status && info.status.status === 'Claimed') {
                results[platform] = info.url_user;
              }
            }
            
            // حذف الملف المؤقت
            fs.unlinkSync(outputFile);
          } else {
            // إذا لم يتم إنشاء ملف JSON، حاول تحليل stdout
            const lines = stdout.split('\n');
            for (const line of lines) {
              // Sherlock يطبع: [+] Platform: URL
              const match = line.match(/\[\+\]\s+([^:]+):\s+(https?:\/\/[^\s]+)/);
              if (match) {
                results[match[1].trim()] = match[2].trim();
              }
            }
          }
          
          resolve(results);
        } catch (parseError) {
          console.error('Error parsing Sherlock output:', parseError);
          resolve(results); // إرجاع ما تم جمعه حتى الآن
        }
      });
    });
  }

  /**
   * البحث في مواقع محددة فقط
   */
  async searchSpecificSites(username, sites) {
    return new Promise((resolve, reject) => {
      const sitesArg = sites.join(',');
      const command = `sherlock ${username} --site ${sitesArg} --timeout 10`;
      
      exec(command, (error, stdout, stderr) => {
        const results = {};
        const lines = stdout.split('\n');
        
        for (const line of lines) {
          const match = line.match(/\[\+\]\s+([^:]+):\s+(https?:\/\/[^\s]+)/);
          if (match) {
            results[match[1].trim()] = match[2].trim();
          }
        }
        
        resolve(results);
      });
    });
  }
}

module.exports = SherlockCollector;
