const BaseCollector = require('./baseCollector');
const axios = require('axios');

/**
 * HIBPCollector - دمج حقيقي مع HaveIBeenPwned API
 * يتحقق من التسريبات الأمنية للبريد الإلكتروني
 */
class HIBPCollector extends BaseCollector {
  constructor(db, apiKey = null) {
    super('HIBPCollector', db);
    this.apiKey = apiKey;
    this.baseUrl = 'https://haveibeenpwned.com/api/v3';
    this.userAgent = 'OSINT-Tool-Electron';
  }

  /**
   * جمع البيانات من HaveIBeenPwned
   */
  async collect(personId, searchData) {
    await this.log(personId, 'INFO', 'بدء فحص التسريبات عبر HaveIBeenPwned');
    
    const results = [];
    const email = searchData.email;
    
    if (!email) {
      await this.log(personId, 'WARNING', 'لا يوجد بريد إلكتروني للفحص');
      return results;
    }

    try {
      await this.log(personId, 'INFO', `فحص التسريبات للبريد: ${email}`);
      
      // فحص التسريبات
      const breaches = await this.checkBreaches(email);
      
      // فحص اللصق (Pastes)
      const pastes = await this.checkPastes(email);
      
      // حفظ التسريبات في قاعدة البيانات
      for (const breach of breaches) {
        const breachData = {
          breach_name: breach.Name,
          domain: breach.Domain,
          breach_date: breach.BreachDate,
          description: breach.Description,
          data_classes: JSON.stringify(breach.DataClasses),
          additional_data: JSON.stringify({
            source: 'HaveIBeenPwned',
            verified: breach.IsVerified,
            fabricated: breach.IsFabricated,
            sensitive: breach.IsSensitive,
            retired: breach.IsRetired,
            spam_list: breach.IsSpamList,
            logo_path: breach.LogoPath,
            pwn_count: breach.PwnCount
          })
        };
        
        const result = this.db.addBreach(
          personId,
          breachData.breach_name,
          breachData.domain,
          breachData.breach_date,
          breachData.description,
          breachData.data_classes,
          breachData.additional_data
        );
        
        results.push({
          id: result.lastInsertRowid,
          type: 'breach',
          ...breachData
        });
      }
      
      // حفظ اللصق
      for (const paste of pastes) {
        const pasteData = {
          breach_name: `Paste: ${paste.Source}`,
          domain: paste.Source,
          breach_date: paste.Date ? paste.Date.split('T')[0] : null,
          description: `تم العثور على البريد في لصق على ${paste.Source}`,
          data_classes: JSON.stringify(['Email', 'Paste']),
          additional_data: JSON.stringify({
            source: 'HaveIBeenPwned-Pastes',
            paste_id: paste.Id,
            title: paste.Title,
            email_count: paste.EmailCount
          })
        };
        
        const result = this.db.addBreach(
          personId,
          pasteData.breach_name,
          pasteData.domain,
          pasteData.breach_date,
          pasteData.description,
          pasteData.data_classes,
          pasteData.additional_data
        );
        
        results.push({
          id: result.lastInsertRowid,
          type: 'paste',
          ...pasteData
        });
      }
      
      await this.log(personId, 'SUCCESS', `تم العثور على ${breaches.length} تسريب و ${pastes.length} لصق`);
      
    } catch (error) {
      await this.log(personId, 'ERROR', `خطأ في HaveIBeenPwned: ${error.message}`);
      console.error('HIBP error:', error);
    }
    
    return results;
  }

  /**
   * فحص التسريبات للبريد الإلكتروني
   */
  async checkBreaches(email) {
    try {
      const headers = {
        'User-Agent': this.userAgent
      };
      
      // إضافة API Key إذا كان متوفراً (للوصول الكامل)
      if (this.apiKey) {
        headers['hibp-api-key'] = this.apiKey;
      }
      
      const response = await axios.get(
        `${this.baseUrl}/breachedaccount/${encodeURIComponent(email)}`,
        { 
          headers,
          timeout: 30000,
          validateStatus: (status) => status === 200 || status === 404
        }
      );
      
      if (response.status === 404) {
        // لا توجد تسريبات
        return [];
      }
      
      return response.data || [];
      
    } catch (error) {
      if (error.response && error.response.status === 429) {
        throw new Error('تم تجاوز الحد المسموح من الطلبات. يرجى الانتظار أو استخدام API Key');
      }
      
      if (error.response && error.response.status === 401) {
        throw new Error('API Key غير صالح');
      }
      
      throw error;
    }
  }

  /**
   * فحص اللصق (Pastes) للبريد الإلكتروني
   */
  async checkPastes(email) {
    try {
      // ملاحظة: فحص Pastes يتطلب API Key
      if (!this.apiKey) {
        console.log('تخطي فحص Pastes - يتطلب API Key');
        return [];
      }
      
      const response = await axios.get(
        `${this.baseUrl}/pasteaccount/${encodeURIComponent(email)}`,
        {
          headers: {
            'User-Agent': this.userAgent,
            'hibp-api-key': this.apiKey
          },
          timeout: 30000,
          validateStatus: (status) => status === 200 || status === 404
        }
      );
      
      if (response.status === 404) {
        return [];
      }
      
      return response.data || [];
      
    } catch (error) {
      console.error('Error checking pastes:', error.message);
      return [];
    }
  }

  /**
   * الحصول على جميع التسريبات المعروفة
   */
  async getAllBreaches() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/breaches`,
        {
          headers: {
            'User-Agent': this.userAgent
          },
          timeout: 30000
        }
      );
      
      return response.data || [];
      
    } catch (error) {
      console.error('Error getting all breaches:', error.message);
      return [];
    }
  }

  /**
   * تعيين API Key
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }
}

module.exports = HIBPCollector;
