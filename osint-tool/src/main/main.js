const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const DatabaseManager = require('../database/schema');
const SocialMediaCollector = require('../modules/socialMediaCollector');
const BreachCollector = require('../modules/breachCollector');
const WhoisCollector = require('../modules/whoisCollector');
const CorrelationEngine = require('../utils/correlationEngine');

let mainWindow;
let db;
let collectors = {};
let correlationEngine;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // فتح أدوات المطور في وضع التطوير
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initializeDatabase() {
  try {
    db = new DatabaseManager();
    console.log('Database initialized successfully');
    
    // تهيئة وحدات الجمع
    collectors.socialMedia = new SocialMediaCollector(db);
    collectors.breach = new BreachCollector(db);
    collectors.whois = new WhoisCollector(db);
    
    // تهيئة محرك التحليل
    correlationEngine = new CorrelationEngine(db);
    
    console.log('Collectors initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

app.whenReady().then(() => {
  initializeDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) {
      db.close();
    }
    app.quit();
  }
});

// معالجات IPC

// إضافة شخص جديد
ipcMain.handle('add-person', async (event, data) => {
  try {
    const personId = db.addPerson(data.name, data.email, data.username);
    return { success: true, personId };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// الحصول على جميع الأشخاص
ipcMain.handle('get-all-persons', async () => {
  try {
    const persons = db.getAllPersons();
    return { success: true, persons };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// الحصول على شخص محدد
ipcMain.handle('get-person', async (event, personId) => {
  try {
    const person = db.getPerson(personId);
    return { success: true, person };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// بدء عملية البحث الشاملة
ipcMain.handle('start-investigation', async (event, personId) => {
  try {
    const person = db.getPerson(personId);
    if (!person) {
      return { success: false, error: 'Person not found' };
    }

    const searchData = {
      name: person.name,
      email: person.email,
      username: person.username
    };

    // إرسال تحديثات للواجهة
    const sendUpdate = (message) => {
      if (mainWindow) {
        mainWindow.webContents.send('investigation-update', message);
      }
    };

    sendUpdate({ status: 'info', message: 'بدء عملية البحث الشامل...' });

    // تشغيل وحدات الجمع بشكل متتالي
    const results = {
      socialAccounts: [],
      breaches: [],
      domains: []
    };

    // 1. البحث عن الحسابات الاجتماعية
    sendUpdate({ status: 'info', message: 'البحث عن الحسابات الاجتماعية...' });
    results.socialAccounts = await collectors.socialMedia.collect(personId, searchData);
    sendUpdate({ status: 'success', message: `تم العثور على ${results.socialAccounts.length} حساب اجتماعي` });

    // 2. فحص التسريبات
    sendUpdate({ status: 'info', message: 'فحص التسريبات...' });
    results.breaches = await collectors.breach.collect(personId, searchData);
    sendUpdate({ status: 'warning', message: `تم العثور على ${results.breaches.length} تسريب` });

    // 3. فحص النطاقات
    sendUpdate({ status: 'info', message: 'فحص النطاقات...' });
    results.domains = await collectors.whois.collect(personId, searchData);
    sendUpdate({ status: 'success', message: `تم العثور على ${results.domains.length} نطاق` });

    // 4. تحليل البيانات وبناء العلاقات
    sendUpdate({ status: 'info', message: 'تحليل البيانات وبناء شبكة العلاقات...' });
    const report = correlationEngine.generateReport(personId);
    sendUpdate({ status: 'success', message: 'تم الانتهاء من التحليل بنجاح!' });

    return { success: true, results, report };
  } catch (error) {
    console.error('Investigation error:', error);
    return { success: false, error: error.message };
  }
});

// الحصول على تقرير شامل
ipcMain.handle('get-report', async (event, personId) => {
  try {
    const report = correlationEngine.generateReport(personId);
    return { success: true, report };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// الحصول على شبكة العلاقات
ipcMain.handle('get-graph', async (event, personId) => {
  try {
    const graph = correlationEngine.buildRelationshipGraph(personId);
    return { success: true, graph };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// الحصول على السجلات
ipcMain.handle('get-logs', async (event, personId) => {
  try {
    const logs = db.getLogs(personId);
    return { success: true, logs };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// حساب التشابه بين حسابين
ipcMain.handle('calculate-similarity', async (event, account1Id, account2Id) => {
  try {
    const accounts = db.getSocialAccounts(account1Id);
    const account1 = accounts.find(a => a.id === account1Id);
    const account2 = accounts.find(a => a.id === account2Id);
    
    if (!account1 || !account2) {
      return { success: false, error: 'Accounts not found' };
    }

    const similarity = correlationEngine.calculateSimilarity(account1, account2);
    return { success: true, similarity };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

console.log('OSINT Tool - Main process started');
