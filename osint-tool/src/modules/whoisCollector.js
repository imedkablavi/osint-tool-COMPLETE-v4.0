const BaseCollector = require('./baseCollector');

class WhoisCollector extends BaseCollector {
  constructor(db) {
    super('WhoisCollector', db);
  }

  async collect(personId, searchData) {
    await this.log(personId, 'INFO', 'بدء فحص النطاقات');
    
    const results = [];
    const email = searchData.email;

    if (!email) {
      await this.log(personId, 'WARNING', 'لم يتم توفير بريد إلكتروني لاستخراج النطاق');
      return results;
    }

    // استخراج النطاق من البريد الإلكتروني
    const domain = this.extractDomainFromEmail(email);
    
    if (!domain) {
      await this.log(personId, 'WARNING', 'لم يتم العثور على نطاق صالح');
      return results;
    }

    // تجاهل النطاقات الشائعة للبريد الإلكتروني
    const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'protonmail.com'];
    if (commonDomains.includes(domain.toLowerCase())) {
      await this.log(personId, 'INFO', `تم تجاهل النطاق الشائع: ${domain}`);
      return results;
    }

    await this.log(personId, 'INFO', `فحص النطاق: ${domain}`);

    try {
      // محاكاة بيانات WHOIS (في الإصدار الحقيقي، يتم استخدام خدمة WHOIS)
      const whoisData = await this.mockWhoisLookup(domain);
      
      if (whoisData) {
        const domainData = {
          domainName: domain,
          registrar: whoisData.registrar,
          registrantName: whoisData.registrantName,
          registrantEmail: whoisData.registrantEmail,
          creationDate: whoisData.creationDate,
          expirationDate: whoisData.expirationDate,
          nameservers: whoisData.nameservers,
          additionalData: whoisData.additionalData
        };

        const domainId = this.db.addDomain(personId, domainData);
        results.push({ ...domainData, id: domainId });
        
        await this.log(personId, 'SUCCESS', `تم العثور على معلومات النطاق: ${domain}`);
      } else {
        await this.log(personId, 'INFO', `لم يتم العثور على معلومات للنطاق: ${domain}`);
      }

    } catch (error) {
      await this.log(personId, 'ERROR', `خطأ في فحص النطاق: ${error.message}`);
    }

    await this.log(personId, 'SUCCESS', `تم الانتهاء من فحص النطاقات`);
    return results;
  }

  extractDomainFromEmail(email) {
    if (!email || !email.includes('@')) {
      return null;
    }
    return email.split('@')[1].trim();
  }

  async mockWhoisLookup(domain) {
    // محاكاة بيانات WHOIS
    // في الإصدار الحقيقي، يتم استخدام خدمة WHOIS API أو أداة whois
    
    await this.sleep(500); // محاكاة زمن الاستعلام

    // محاكاة: احتمال عشوائي للعثور على بيانات
    if (Math.random() > 0.3) {
      return {
        registrar: 'Example Registrar Inc.',
        registrantName: 'Privacy Protected',
        registrantEmail: 'privacy@example.com',
        creationDate: '2015-01-15',
        expirationDate: '2025-01-15',
        nameservers: ['ns1.example.com', 'ns2.example.com'],
        additionalData: {
          status: 'active',
          dnssec: 'unsigned'
        }
      };
    }

    return null;
  }

  // دالة لإجراء استعلام WHOIS حقيقي (تتطلب تثبيت أداة whois)
  async performRealWhoisLookup(domain) {
    // يمكن استخدام child_process لتشغيل أمر whois
    // أو استخدام خدمة API مثل WhoisXML API
    
    try {
      // مثال باستخدام خدمة API
      const apiUrl = `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=YOUR_API_KEY&domainName=${domain}&outputFormat=JSON`;
      
      const response = await this.makeRequest(apiUrl);
      return this.parseWhoisResponse(response.data);
    } catch (error) {
      throw new Error(`WHOIS lookup failed: ${error.message}`);
    }
  }

  parseWhoisResponse(data) {
    // تحليل استجابة WHOIS وتحويلها إلى تنسيق موحد
    return {
      registrar: data.registrar || 'Unknown',
      registrantName: data.registrantName || 'Unknown',
      registrantEmail: data.registrantEmail || 'Unknown',
      creationDate: data.createdDate || null,
      expirationDate: data.expiresDate || null,
      nameservers: data.nameServers || [],
      additionalData: data
    };
  }
}

module.exports = WhoisCollector;
