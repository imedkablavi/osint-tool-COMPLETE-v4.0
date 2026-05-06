const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

/**
 * ProxyManager - إدارة Proxy وTor للطلبات الحساسة
 */
class ProxyManager {
  constructor() {
    this.proxyEnabled = false;
    this.torEnabled = false;
    this.currentProxy = null;
    this.torProxy = 'socks5://127.0.0.1:9050'; // منفذ Tor الافتراضي
    this.proxyList = [];
  }

  /**
   * تفعيل Tor
   */
  enableTor() {
    this.torEnabled = true;
    this.proxyEnabled = false;
    console.log('تم تفعيل Tor');
  }

  /**
   * تعطيل Tor
   */
  disableTor() {
    this.torEnabled = false;
    console.log('تم تعطيل Tor');
  }

  /**
   * تفعيل Proxy
   */
  enableProxy(proxyUrl) {
    this.proxyEnabled = true;
    this.torEnabled = false;
    this.currentProxy = proxyUrl;
    console.log(`تم تفعيل Proxy: ${proxyUrl}`);
  }

  /**
   * تعطيل Proxy
   */
  disableProxy() {
    this.proxyEnabled = false;
    this.currentProxy = null;
    console.log('تم تعطيل Proxy');
  }

  /**
   * إضافة قائمة Proxies
   */
  addProxyList(proxies) {
    this.proxyList = proxies;
    console.log(`تم إضافة ${proxies.length} proxy`);
  }

  /**
   * الحصول على proxy عشوائي
   */
  getRandomProxy() {
    if (this.proxyList.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * this.proxyList.length);
    return this.proxyList[randomIndex];
  }

  /**
   * إنشاء axios instance مع proxy
   */
  createAxiosInstance() {
    const config = {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    if (this.torEnabled) {
      // استخدام Tor
      const agent = new SocksProxyAgent(this.torProxy);
      config.httpAgent = agent;
      config.httpsAgent = agent;
    } else if (this.proxyEnabled && this.currentProxy) {
      // استخدام Proxy محدد
      const proxyUrl = new URL(this.currentProxy);
      config.proxy = {
        protocol: proxyUrl.protocol.replace(':', ''),
        host: proxyUrl.hostname,
        port: parseInt(proxyUrl.port)
      };
      
      if (proxyUrl.username) {
        config.proxy.auth = {
          username: proxyUrl.username,
          password: proxyUrl.password
        };
      }
    }

    return axios.create(config);
  }

  /**
   * إجراء طلب HTTP مع proxy/tor
   */
  async request(url, options = {}) {
    const axiosInstance = this.createAxiosInstance();
    
    try {
      const response = await axiosInstance.get(url, options);
      return response;
    } catch (error) {
      console.error('Proxy request error:', error.message);
      throw error;
    }
  }

  /**
   * اختبار اتصال Tor
   */
  async testTorConnection() {
    try {
      const agent = new SocksProxyAgent(this.torProxy);
      const response = await axios.get('https://check.torproject.org/api/ip', {
        httpAgent: agent,
        httpsAgent: agent,
        timeout: 10000
      });
      
      if (response.data && response.data.IsTor) {
        console.log('✅ اتصال Tor ناجح');
        console.log(`IP الحالي: ${response.data.IP}`);
        return true;
      } else {
        console.log('❌ لا يتم الاتصال عبر Tor');
        return false;
      }
    } catch (error) {
      console.error('❌ فشل اختبار Tor:', error.message);
      return false;
    }
  }

  /**
   * اختبار proxy
   */
  async testProxy(proxyUrl) {
    try {
      const url = new URL(proxyUrl);
      const config = {
        proxy: {
          protocol: url.protocol.replace(':', ''),
          host: url.hostname,
          port: parseInt(url.port)
        },
        timeout: 10000
      };
      
      if (url.username) {
        config.proxy.auth = {
          username: url.username,
          password: url.password
        };
      }
      
      const response = await axios.get('https://api.ipify.org?format=json', config);
      
      console.log(`✅ Proxy يعمل - IP: ${response.data.ip}`);
      return true;
    } catch (error) {
      console.error(`❌ فشل اختبار Proxy:`, error.message);
      return false;
    }
  }

  /**
   * تدوير Proxy (rotation)
   */
  rotateProxy() {
    if (this.proxyList.length === 0) {
      console.log('لا توجد proxies متاحة للتدوير');
      return null;
    }
    
    this.currentProxy = this.getRandomProxy();
    console.log(`تم التبديل إلى proxy: ${this.currentProxy}`);
    return this.currentProxy;
  }

  /**
   * الحصول على IP الحالي
   */
  async getCurrentIP() {
    try {
      const axiosInstance = this.createAxiosInstance();
      const response = await axiosInstance.get('https://api.ipify.org?format=json');
      return response.data.ip;
    } catch (error) {
      console.error('Error getting current IP:', error.message);
      return null;
    }
  }

  /**
   * تغيير هوية Tor (New Identity)
   */
  async requestNewTorIdentity() {
    // يتطلب اتصال بـ Tor Control Port
    // هذه ميزة متقدمة تحتاج إعداد إضافي
    console.log('طلب هوية جديدة من Tor...');
    
    try {
      // يمكن استخدام مكتبة tor-control-port
      // أو إرسال إشارة SIGHUP لعملية Tor
      console.log('ملاحظة: تغيير هوية Tor يتطلب إعداد Control Port');
      return false;
    } catch (error) {
      console.error('Error requesting new Tor identity:', error.message);
      return false;
    }
  }

  /**
   * الحصول على الحالة الحالية
   */
  getStatus() {
    return {
      torEnabled: this.torEnabled,
      proxyEnabled: this.proxyEnabled,
      currentProxy: this.currentProxy,
      proxyListSize: this.proxyList.length
    };
  }
}

module.exports = ProxyManager;
