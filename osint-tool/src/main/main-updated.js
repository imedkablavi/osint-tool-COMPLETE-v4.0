const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// استيراد قاعدة البيانات
const Database = require('../database/schema');

// استيراد الوحدات الأساسية
const SocialMediaCollector = require('../modules/socialMediaCollector');
const BreachCollector = require('../modules/breachCollector');
const WhoisCollector = require('../modules/whoisCollector');

// استيراد الوحدات الجديدة - OSINT Tools
const SherlockCollector = require('../modules/sherlockCollector');
const MaigretCollector = require('../modules/maigretCollector');
const HoleheCollector = require('../modules/holeheCollector');
const HIBPCollector = require('../modules/hibpCollector');
const GoogleDorksCollector = require('../modules/googleDorksCollector');

// استيراد وحدات التحليل
const ImageAnalyzer = require('../modules/imageAnalyzer');
const StylometryAnalyzer = require('../modules/stylometryAnalyzer');

// استيراد محرك التحليل
const CorrelationEngine = require('../utils/correlationEngine');

// استيراد الأدوات المساعدة
const CacheManager = require('../utils/cacheManager');
const ProxyManager = require('../utils/proxyManager');
const EncryptionManager = require('../utils/encryptionManager');
const ExportManager = require('../utils/exportManager');

let mainWindow;
let db;
let collectors = {};
let analyzers = {};
let utilities = {};

// إنشاء النافذة الرئيسية
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  
  // فتح أدوات المطور في وضع التطوير
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// تهيئة التطبيق
app.whenReady().then(() => {
  // تهيئة قاعدة البيانات
  db = new Database();
  
  // تهيئة الأدوات المساعدة
  utilities.cache = new CacheManager();
  utilities.proxy = new ProxyManager();
  utilities.encryption = new EncryptionManager();
  utilities.export = new ExportManager(db);
  
  // تهيئة الوحدات الأساسية
  collectors.social = new SocialMediaCollector(db);
  collectors.breach = new BreachCollector(db);
  collectors.whois = new WhoisCollector(db);
  
  // تهيئة وحدات OSINT الجديدة
  collectors.sherlock = new SherlockCollector(db);
  collectors.maigret = new MaigretCollector(db);
  collectors.holehe = new HoleheCollector(db);
  collectors.hibp = new HIBPCollector(db);
  collectors.googleDorks = new GoogleDorksCollector(db);
  
  // تهيئة وحدات التحليل
  analyzers.image = new ImageAnalyzer(db);
  analyzers.stylometry = new StylometryAnalyzer(db);
  analyzers.correlation = new CorrelationEngine(db);
  
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ==================== IPC Handlers ====================

/**
 * بدء تحقيق جديد - محسّن مع جميع الأدوات
 */
ipcMain.handle('start-investigation', async (event, searchData) => {
  try {
    // إنشاء سجل شخص جديد
    const personResult = db.addPerson(
      searchData.fullname,
      searchData.email,
      searchData.username,
      searchData.phone
    );
    
    const personId = personResult.lastInsertRowid;
    
    // إرسال تحديث للواجهة
    event.sender.send('investigation-progress', {
      stage: 'init',
      message: 'تم إنشاء التحقيق بنجاح'
    });
    
    // المرحلة 1: البحث الأساسي عن الحسابات الاجتماعية
    event.sender.send('investigation-progress', {
      stage: 'social-basic',
      message: 'البحث الأساسي عن الحسابات...'
    });
    
    await collectors.social.collect(personId, searchData);
    
    // المرحلة 2: Sherlock - بحث سريع في 400+ موقع
    event.sender.send('investigation-progress', {
      stage: 'sherlock',
      message: 'تشغيل Sherlock (400+ موقع)...'
    });
    
    await collectors.sherlock.collect(personId, searchData);
    
    // المرحلة 3: Holehe - التحقق من البريد الإلكتروني
    if (searchData.email) {
      event.sender.send('investigation-progress', {
        stage: 'holehe',
        message: 'التحقق من البريد عبر Holehe...'
      });
      
      await collectors.holehe.collect(personId, searchData);
    }
    
    // المرحلة 4: HaveIBeenPwned - فحص التسريبات
    if (searchData.email) {
      event.sender.send('investigation-progress', {
        stage: 'hibp',
        message: 'فحص التسريبات عبر HaveIBeenPwned...'
      });
      
      await collectors.hibp.collect(personId, searchData);
    }
    
    // المرحلة 5: Google Dorks - بحث متقدم
    event.sender.send('investigation-progress', {
      stage: 'google-dorks',
      message: 'تنفيذ Google Dorks...'
    });
    
    await collectors.googleDorks.collect(personId, searchData);
    
    // المرحلة 6: Maigret - بحث معمق (اختياري - يستغرق وقتاً)
    // يمكن تفعيله حسب رغبة المستخدم
    if (searchData.deepSearch) {
      event.sender.send('investigation-progress', {
        stage: 'maigret',
        message: 'البحث المعمق عبر Maigret (قد يستغرق عدة دقائق)...'
      });
      
      await collectors.maigret.collect(personId, searchData);
    }
    
    // المرحلة 7: WHOIS للنطاقات
    if (searchData.domain) {
      event.sender.send('investigation-progress', {
        stage: 'whois',
        message: 'تحليل معلومات النطاق...'
      });
      
      await collectors.whois.collect(personId, { domain: searchData.domain });
    }
    
    // المرحلة 8: تحليل العلاقات
    event.sender.send('investigation-progress', {
      stage: 'correlation',
      message: 'تحليل العلاقات وبناء الرسم البياني...'
    });
    
    const correlationResults = await analyzers.correlation.analyzeAndCorrelate(personId);
    const graphData = await analyzers.correlation.buildGraph(personId);
    
    // المرحلة 9: توليد التقرير
    event.sender.send('investigation-progress', {
      stage: 'report',
      message: 'توليد التقرير النهائي...'
    });
    
    const report = await analyzers.correlation.generateReport(personId);
    
    // إرسال النتائج النهائية
    event.sender.send('investigation-complete', {
      personId: personId,
      report: report,
      graphData: graphData
    });
    
    return {
      success: true,
      personId: personId,
      message: 'تم إكمال التحقيق بنجاح'
    };
    
  } catch (error) {
    console.error('Investigation error:', error);
    event.sender.send('investigation-error', {
      message: error.message
    });
    
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * تحليل صورة
 */
ipcMain.handle('analyze-image', async (event, { personId, imageUrl }) => {
  try {
    const results = await analyzers.image.analyzeImage(personId, imageUrl);
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * تحليل نص (Stylometry)
 */
ipcMain.handle('analyze-text', async (event, { personId, text, source }) => {
  try {
    const results = await analyzers.stylometry.analyzeText(personId, text, source);
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * تصدير تحقيق
 */
ipcMain.handle('export-investigation', async (event, { personId, formats }) => {
  try {
    const results = await utilities.export.exportInvestigation(personId, formats);
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * تفعيل/تعطيل Tor
 */
ipcMain.handle('toggle-tor', async (event, enabled) => {
  try {
    if (enabled) {
      utilities.proxy.enableTor();
      const isWorking = await utilities.proxy.testTorConnection();
      return { success: isWorking, message: isWorking ? 'تم تفعيل Tor' : 'فشل الاتصال بـ Tor' };
    } else {
      utilities.proxy.disableTor();
      return { success: true, message: 'تم تعطيل Tor' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * تفعيل/تعطيل Proxy
 */
ipcMain.handle('toggle-proxy', async (event, { enabled, proxyUrl }) => {
  try {
    if (enabled) {
      utilities.proxy.enableProxy(proxyUrl);
      const isWorking = await utilities.proxy.testProxy(proxyUrl);
      return { success: isWorking, message: isWorking ? 'تم تفعيل Proxy' : 'فشل الاتصال بـ Proxy' };
    } else {
      utilities.proxy.disableProxy();
      return { success: true, message: 'تم تعطيل Proxy' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * تشفير قاعدة البيانات
 */
ipcMain.handle('encrypt-database', async (event) => {
  try {
    const dbPath = path.join(__dirname, '../../data/osint.db');
    const encryptedPath = utilities.encryption.encryptDatabase(dbPath);
    return { success: true, path: encryptedPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * مسح Cache
 */
ipcMain.handle('clear-cache', async (event) => {
  try {
    utilities.cache.clear();
    return { success: true, message: 'تم مسح Cache بنجاح' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * الحصول على إحصائيات Cache
 */
ipcMain.handle('get-cache-stats', async (event) => {
  try {
    const stats = utilities.cache.getStats();
    return { success: true, stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * الحصول على جميع التحقيقات
 */
ipcMain.handle('get-all-investigations', async (event) => {
  try {
    const persons = db.getAllPersons();
    return { success: true, investigations: persons };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * الحصول على تفاصيل تحقيق
 */
ipcMain.handle('get-investigation-details', async (event, personId) => {
  try {
    const person = db.getPerson(personId);
    const socialAccounts = db.getSocialAccountsByPerson(personId);
    const breaches = db.getBreachesByPerson(personId);
    const domains = db.getDomainsByPerson(personId);
    const logs = db.getLogsByPerson(personId);
    
    return {
      success: true,
      data: {
        person,
        socialAccounts,
        breaches,
        domains,
        logs
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * الحصول على بيانات الرسم البياني
 */
ipcMain.handle('get-graph-data', async (event, personId) => {
  try {
    const graphData = await analyzers.correlation.buildGraph(personId);
    return { success: true, data: graphData };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * حذف تحقيق
 */
ipcMain.handle('delete-investigation', async (event, personId) => {
  try {
    db.deletePerson(personId);
    return { success: true, message: 'تم حذف التحقيق بنجاح' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

console.log('✅ OSINT Tool - تم تحميل جميع الوحدات بنجاح');
console.log('📦 الوحدات المحملة:');
console.log('   - Sherlock (400+ مواقع)');
console.log('   - Maigret (3000+ مواقع)');
console.log('   - Holehe (120+ مواقع)');
console.log('   - HaveIBeenPwned API');
console.log('   - Google Dorks');
console.log('   - Image Analyzer (EXIF + Reverse Search)');
console.log('   - Stylometry Analyzer');
console.log('   - Cache Manager');
console.log('   - Proxy/Tor Manager');
console.log('   - Encryption Manager');
console.log('   - Export Manager (PDF, CSV, JSON)');
