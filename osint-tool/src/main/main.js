const { app, BrowserWindow, ipcMain, shell, safeStorage, session } = require('electron');
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

const DatabaseManager = require('../database/schema');
const SocialMediaCollector = require('../modules/socialMediaCollector');
const HIBPCollector = require('../modules/hibpCollector');
const WhoisCollector = require('../modules/whoisCollector');
const CorrelationEngine = require('../utils/correlationEngine');

let mainWindow = null;
let db = null;
let collectors = {};
let correlationEngine = null;

const MAX_NAME_LENGTH = 180;
const MAX_EMAIL_LENGTH = 320;
const MAX_USERNAME_LENGTH = 120;

function isDevelopment() {
  return process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
}

function sanitizeText(value, maxLength) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLength);
}

function normalizePersonInput(input = {}) {
  const name = sanitizeText(input.name, MAX_NAME_LENGTH);
  const email = sanitizeText(input.email, MAX_EMAIL_LENGTH).toLowerCase();
  const username = sanitizeText(input.username, MAX_USERNAME_LENGTH).replace(/^@+/, '');

  if (!email && !username) {
    throw new Error('Email or username is required.');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email address.');
  }
  if (username && !/^[\p{L}\p{N}._-]+$/u.test(username)) {
    throw new Error('Username contains unsupported characters.');
  }

  return { name, email, username };
}

function assertPersonId(value) {
  const personId = Number(value);
  if (!Number.isSafeInteger(personId) || personId <= 0) {
    throw new Error('Invalid case identifier.');
  }
  return personId;
}

function isAllowedExternalUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function assertTrustedSender(event) {
  const senderUrl = event?.senderFrame?.url || event?.sender?.getURL?.() || '';
  let senderPath;
  try {
    const parsed = new URL(senderUrl);
    if (parsed.protocol !== 'file:') throw new Error('Untrusted IPC sender protocol.');
    senderPath = path.resolve(fileURLToPath(parsed));
  } catch {
    throw new Error('Untrusted IPC sender.');
  }

  const rendererRoot = path.resolve(__dirname, '../renderer');
  if (senderPath !== rendererRoot && !senderPath.startsWith(`${rendererRoot}${path.sep}`)) {
    throw new Error('Untrusted IPC sender path.');
  }
}

function secureStorageAvailable() {
  if (!safeStorage.isEncryptionAvailable()) return false;
  if (process.platform === 'linux' && typeof safeStorage.getSelectedStorageBackend === 'function') {
    return safeStorage.getSelectedStorageBackend() !== 'basic_text';
  }
  return true;
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readSettingsFile() {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('Failed to read settings:', error.message);
    return {};
  }
}

function decryptSecret(value) {
  if (!value || !secureStorageAvailable()) return '';
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch {
    return '';
  }
}

function getRuntimeSettings() {
  const stored = readSettingsFile();
  const hibpApiKey = decryptSecret(stored.hibpApiKeyEncrypted);
  return {
    hibpApiKey,
    hasHibpApiKey: Boolean(hibpApiKey)
  };
}

function saveSettings(input = {}) {
  const existing = readSettingsFile();
  const next = { ...existing };
  const apiKey = sanitizeText(input.hibpApiKey, 128);

  if (input.clearHibpApiKey === true) {
    delete next.hibpApiKeyEncrypted;
  } else if (apiKey) {
    if (!secureStorageAvailable()) {
      throw new Error('Secure credential storage is unavailable on this system. The API key was not saved.');
    }
    next.hibpApiKeyEncrypted = safeStorage.encryptString(apiKey).toString('base64');
  }

  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), { mode: 0o600 });
  return { hasHibpApiKey: Boolean(next.hibpApiKeyEncrypted) };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    backgroundColor: '#0b1220',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: isDevelopment(),
      spellcheck: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url).catch((error) => console.error('Failed to open external URL:', error.message));
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow.webContents.getURL();
    if (url !== currentUrl) event.preventDefault();
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (isDevelopment()) mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initializeServices() {
  const databasePath = path.join(app.getPath('userData'), 'osint.db');
  db = new DatabaseManager(databasePath);

  const settings = getRuntimeSettings();
  collectors.socialMedia = new SocialMediaCollector(db);
  collectors.hibp = new HIBPCollector(db, settings.hibpApiKey);
  collectors.whois = new WhoisCollector(db);
  correlationEngine = new CorrelationEngine(db);
}

function sendInvestigationUpdate(sender, status, message) {
  if (!sender || sender.isDestroyed()) return;
  sender.send('investigation-update', { status, message });
}

ipcMain.handle('add-person', async (event, data) => {
  try {
    assertTrustedSender(event);
    const person = normalizePersonInput(data);
    const personId = db.addPerson(person.name, person.email, person.username);
    return { success: true, personId: Number(personId) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-all-persons', async (event) => {
  try {
    assertTrustedSender(event);
    return { success: true, persons: db.getAllPersons() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-investigation', async (event, payload = {}) => {
  try {
    assertTrustedSender(event);
    if (payload.authorizedUse !== true) {
      throw new Error('Authorized-use confirmation is required before running a case.');
    }

    const personId = assertPersonId(payload.personId);
    const person = db.getPerson(personId);
    if (!person) throw new Error('Case not found.');

    const searchData = { name: person.name, email: person.email, username: person.username };
    const results = { socialAccounts: [], breaches: [], domains: [] };

    sendInvestigationUpdate(event.sender, 'info', 'Starting public-source collection…');

    if (searchData.username) {
      sendInvestigationUpdate(event.sender, 'info', 'Checking public profile URLs…');
      results.socialAccounts = await collectors.socialMedia.collect(personId, searchData);
      sendInvestigationUpdate(event.sender, 'success', `Profile checks completed: ${results.socialAccounts.length} possible matches.`);
    }

    if (searchData.email) {
      const settings = getRuntimeSettings();
      collectors.hibp.setApiKey(settings.hibpApiKey);
      if (settings.hibpApiKey) {
        sendInvestigationUpdate(event.sender, 'info', 'Checking Have I Been Pwned…');
        results.breaches = await collectors.hibp.collect(personId, searchData);
        sendInvestigationUpdate(event.sender, 'success', `HIBP check completed: ${results.breaches.length} breach records.`);
      } else {
        db.addLog(personId, 'HIBPCollector', 'WARNING', 'HIBP skipped because no API key is configured.');
        sendInvestigationUpdate(event.sender, 'warning', 'HIBP skipped: configure an API key in Settings for live breach checks.');
      }

      sendInvestigationUpdate(event.sender, 'info', 'Resolving domain registration data through RDAP…');
      results.domains = await collectors.whois.collect(personId, searchData);
      sendInvestigationUpdate(event.sender, 'success', `RDAP check completed: ${results.domains.length} domain record(s).`);
    }

    sendInvestigationUpdate(event.sender, 'info', 'Building case correlation report…');
    const report = correlationEngine.generateReport(personId);
    sendInvestigationUpdate(event.sender, 'success', 'Case completed.');

    return { success: true, results, report };
  } catch (error) {
    console.error('Investigation error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-report', async (event, rawPersonId) => {
  try {
    assertTrustedSender(event);
    const personId = assertPersonId(rawPersonId);
    if (!db.getPerson(personId)) throw new Error('Case not found.');
    return { success: true, report: correlationEngine.generateReport(personId) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('settings:get', async (event) => {
  try {
    assertTrustedSender(event);
    const settings = getRuntimeSettings();
    return {
      success: true,
      settings: {
        hasHibpApiKey: settings.hasHibpApiKey,
        secureStorageAvailable: secureStorageAvailable()
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('settings:save', async (event, settings) => {
  try {
    assertTrustedSender(event);
    const saved = saveSettings(settings);
    collectors.hibp?.setApiKey(getRuntimeSettings().hibpApiKey);
    return { success: true, settings: saved };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-external', async (event, rawUrl) => {
  try {
    assertTrustedSender(event);
    const url = sanitizeText(rawUrl, 2048);
    if (!isAllowedExternalUrl(url)) throw new Error('Only HTTPS links can be opened.');
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  initializeServices();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  try {
    db?.close();
  } catch (error) {
    console.error('Failed to close database:', error.message);
  }
});
