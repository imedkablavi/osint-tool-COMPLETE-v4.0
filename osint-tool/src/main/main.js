const { app, BrowserWindow, ipcMain, shell, safeStorage, session, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

const DatabaseManager = require('../database/schema');
const SocialMediaCollector = require('../modules/socialMediaCollector');
const HIBPCollector = require('../modules/hibpCollector');
const WhoisCollector = require('../modules/whoisCollector');
const BraveSearchCollector = require('../modules/braveSearchCollector');
const PassiveEnrichmentPipeline = require('../modules/passiveEnrichmentPipeline');
const SherlockCollector = require('../modules/sherlockCollector');
const MaigretCollector = require('../modules/maigretCollector');
const ImageAnalyzer = require('../modules/imageAnalyzer');
const CorrelationEngine = require('../utils/correlationEngine');
const ReportExporter = require('../utils/reportExporter');
const ToolRegistry = require('../utils/toolRegistry');

let mainWindow = null;
let db = null;
let collectors = {};
let correlationEngine = null;
let toolRegistry = null;

const MAX_NAME_LENGTH = 180;
const MAX_EMAIL_LENGTH = 320;
const MAX_USERNAME_LENGTH = 120;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.heic', '.heif']);

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

  if (!email && !username) throw new Error('Email or username is required.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email address.');
  if (username && !/^[\p{L}\p{N}._-]+$/u.test(username)) throw new Error('Username contains unsupported characters.');
  return { name, email, username };
}

function assertPersonId(value) {
  const personId = Number(value);
  if (!Number.isSafeInteger(personId) || personId <= 0) throw new Error('Invalid case identifier.');
  return personId;
}

function isAllowedExternalUrl(rawUrl) {
  try {
    return new URL(rawUrl).protocol === 'https:';
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
    const parsed = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
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
  const braveApiKey = decryptSecret(stored.braveApiKeyEncrypted);
  const urlscanApiKey = decryptSecret(stored.urlscanApiKeyEncrypted);
  const virusTotalApiKey = decryptSecret(stored.virusTotalApiKeyEncrypted);
  return {
    hibpApiKey,
    braveApiKey,
    urlscanApiKey,
    virusTotalApiKey,
    hasHibpApiKey: Boolean(hibpApiKey),
    hasBraveApiKey: Boolean(braveApiKey),
    hasUrlscanApiKey: Boolean(urlscanApiKey),
    hasVirusTotalApiKey: Boolean(virusTotalApiKey)
  };
}

function getToolStatus() {
  const settings = getRuntimeSettings();
  return toolRegistry ? toolRegistry.getStatus({
    hasHibpApiKey: settings.hasHibpApiKey,
    hasBraveApiKey: settings.hasBraveApiKey,
    hasUrlscanApiKey: settings.hasUrlscanApiKey,
    hasVirusTotalApiKey: settings.hasVirusTotalApiKey
  }) : {};
}

function applySecretSetting(next, input, config) {
  if (input[config.clearInput] === true) {
    delete next[config.storageField];
    return;
  }
  const value = sanitizeText(input[config.valueInput], config.maxLength);
  if (!value) return;
  if (!secureStorageAvailable()) throw new Error('Secure credential storage is unavailable on this system. The API key was not saved.');
  next[config.storageField] = safeStorage.encryptString(value).toString('base64');
}

function saveSettings(input = {}) {
  const next = { ...readSettingsFile() };
  const configs = [
    ['hibpApiKey', 'clearHibpApiKey', 'hibpApiKeyEncrypted', 128],
    ['braveApiKey', 'clearBraveApiKey', 'braveApiKeyEncrypted', 256],
    ['urlscanApiKey', 'clearUrlscanApiKey', 'urlscanApiKeyEncrypted', 256],
    ['virusTotalApiKey', 'clearVirusTotalApiKey', 'virusTotalApiKeyEncrypted', 256]
  ];
  for (const [valueInput, clearInput, storageField, maxLength] of configs) {
    applySecretSetting(next, input, { valueInput, clearInput, storageField, maxLength });
  }

  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), { mode: 0o600 });
  return {
    hasHibpApiKey: Boolean(next.hibpApiKeyEncrypted),
    hasBraveApiKey: Boolean(next.braveApiKeyEncrypted),
    hasUrlscanApiKey: Boolean(next.urlscanApiKeyEncrypted),
    hasVirusTotalApiKey: Boolean(next.virusTotalApiKeyEncrypted)
  };
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
    if (isAllowedExternalUrl(url)) shell.openExternal(url).catch((error) => console.error('Failed to open external URL:', error.message));
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  if (isDevelopment()) mainWindow.webContents.openDevTools({ mode: 'detach' });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function initializeServices() {
  db = new DatabaseManager(path.join(app.getPath('userData'), 'osint.db'));
  const settings = getRuntimeSettings();
  collectors.socialMedia = new SocialMediaCollector(db);
  collectors.hibp = new HIBPCollector(db, settings.hibpApiKey);
  collectors.whois = new WhoisCollector(db);
  collectors.braveSearch = new BraveSearchCollector(db, settings.braveApiKey);
  collectors.passiveEnrichment = new PassiveEnrichmentPipeline(db, settings);
  collectors.sherlock = new SherlockCollector(db);
  collectors.maigret = new MaigretCollector(db);
  collectors.imageAnalyzer = new ImageAnalyzer(db);
  correlationEngine = new CorrelationEngine(db);
  toolRegistry = new ToolRegistry({
    sherlock: collectors.sherlock,
    maigret: collectors.maigret,
    imageAnalyzer: collectors.imageAnalyzer
  });
}

function sendInvestigationUpdate(sender, status, message) {
  if (sender && !sender.isDestroyed()) sender.send('investigation-update', { status, message });
}

async function runExtendedUsernameTools(event, personId, searchData, results) {
  const status = getToolStatus();
  let added = 0;
  if (status.sherlock?.available) {
    sendInvestigationUpdate(event.sender, 'info', 'Running local Sherlock extended username search…');
    const rows = await collectors.sherlock.collect(personId, searchData);
    results.socialAccounts.push(...rows);
    added += rows.length;
  } else {
    db.addLog(personId, 'SherlockCollector', 'WARNING', status.sherlock?.reason || 'Sherlock unavailable.');
  }
  if (status.maigret?.available) {
    sendInvestigationUpdate(event.sender, 'info', 'Running local Maigret extended username search…');
    const rows = await collectors.maigret.collect(personId, searchData);
    results.socialAccounts.push(...rows);
    added += rows.length;
  } else {
    db.addLog(personId, 'MaigretCollector', 'WARNING', status.maigret?.reason || 'Maigret unavailable.');
  }
  return added;
}

function parseMaybeJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function buildPassiveTargets(searchData, domainResults = []) {
  const domains = new Set();
  const ips = new Set();

  if (searchData.email) {
    const derived = collectors.whois.extractDomainFromEmail(searchData.email);
    if (derived && !collectors.whois.isConsumerMailboxDomain(derived)) domains.add(derived);
  }

  for (const row of domainResults) {
    const domain = String(row.domainName || row.domain_name || '').trim().toLowerCase();
    if (domain) domains.add(domain);
    const additional = parseMaybeJson(row.additionalData || row.additional_data, {});
    for (const type of ['A', 'AAAA']) {
      for (const record of additional.dns?.[type] || []) {
        if (record?.value) ips.add(String(record.value).trim());
      }
    }
  }

  return { domains: [...domains].slice(0, 3), ips: [...ips].slice(0, 12) };
}

ipcMain.handle('add-person', async (event, data) => {
  try {
    assertTrustedSender(event);
    const person = normalizePersonInput(data);
    return { success: true, personId: Number(db.addPerson(person.name, person.email, person.username)) };
  } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('get-all-persons', async (event) => {
  try { assertTrustedSender(event); return { success: true, persons: db.getAllPersons() }; }
  catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('start-investigation', async (event, payload = {}) => {
  try {
    assertTrustedSender(event);
    if (payload.authorizedUse !== true) throw new Error('Authorized-use confirmation is required before running a case.');
    const personId = assertPersonId(payload.personId);
    const person = db.getPerson(personId);
    if (!person) throw new Error('Case not found.');

    const searchData = { name: person.name, email: person.email, username: person.username };
    const results = { socialAccounts: [], breaches: [], domains: [], searchResults: [], enrichmentStatus: {} };
    sendInvestigationUpdate(event.sender, 'info', 'Starting live public-source collection…');

    if (searchData.username) {
      sendInvestigationUpdate(event.sender, 'info', 'Querying official public profile APIs and supported public pages…');
      results.socialAccounts = await collectors.socialMedia.collect(personId, searchData);
      sendInvestigationUpdate(event.sender, 'success', `Built-in public profile sources returned ${results.socialAccounts.length} result(s).`);
      if (payload.extendedUsernameSearch === true) {
        const added = await runExtendedUsernameTools(event, personId, searchData, results);
        sendInvestigationUpdate(event.sender, 'info', `Extended username tools added ${added} deduplicated result(s).`);
      }
    }

    if (searchData.email) {
      const settings = getRuntimeSettings();
      collectors.hibp.setApiKey(settings.hibpApiKey);
      if (settings.hibpApiKey) {
        sendInvestigationUpdate(event.sender, 'info', 'Checking Have I Been Pwned…');
        results.breaches = await collectors.hibp.collect(personId, searchData);
        sendInvestigationUpdate(event.sender, 'success', `HIBP check completed: ${results.breaches.length} breach record(s).`);
      } else {
        db.addLog(personId, 'HIBPCollector', 'WARNING', 'HIBP skipped because no API key is configured.');
        sendInvestigationUpdate(event.sender, 'warning', 'HIBP skipped: configure an API key in Settings for live breach checks.');
      }

      sendInvestigationUpdate(event.sender, 'info', 'Collecting RDAP, live DNS and certificate-transparency evidence…');
      results.domains = await collectors.whois.collect(personId, searchData);
      sendInvestigationUpdate(event.sender, 'success', `Domain intelligence completed: ${results.domains.length} domain evidence record(s).`);
    }

    const runtimeSettings = getRuntimeSettings();
    collectors.braveSearch.setApiKey(runtimeSettings.braveApiKey);
    if (runtimeSettings.braveApiKey) {
      sendInvestigationUpdate(event.sender, 'info', 'Running bounded Brave Search API discovery…');
      const rows = await collectors.braveSearch.collect(personId, searchData);
      results.searchResults.push(...rows);
      sendInvestigationUpdate(event.sender, 'success', `Web search completed: ${rows.length} deduplicated result(s).`);
    } else {
      db.addLog(personId, 'BraveSearchCollector', 'WARNING', 'Brave Search skipped because no API key is configured.');
      sendInvestigationUpdate(event.sender, 'warning', 'Web search skipped: configure a Brave Search API key in Settings.');
    }

    const targets = buildPassiveTargets(searchData, results.domains);
    collectors.passiveEnrichment.setCredentials(runtimeSettings);
    if (targets.domains.length || targets.ips.length) {
      sendInvestigationUpdate(event.sender, 'info', 'Running passive archive, website-scan, reputation and IP registry enrichment…');
      const enrichment = await collectors.passiveEnrichment.collect(personId, targets, runtimeSettings);
      results.searchResults.push(...enrichment.results);
      results.enrichmentStatus = enrichment.status;
      sendInvestigationUpdate(event.sender, 'success', `Passive enrichment added ${enrichment.results.length} evidence record(s).`);
    }

    sendInvestigationUpdate(event.sender, 'info', 'Building evidence correlation report…');
    const report = correlationEngine.generateReport(personId);
    sendInvestigationUpdate(event.sender, 'success', 'Case completed.');
    return { success: true, results, report, tools: getToolStatus() };
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
  } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('delete-case', async (event, rawPersonId) => {
  try {
    assertTrustedSender(event);
    const result = db.deletePerson(assertPersonId(rawPersonId));
    if (!result?.changes) throw new Error('Case not found.');
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('export-report', async (event, payload = {}) => {
  try {
    assertTrustedSender(event);
    const personId = assertPersonId(payload.personId);
    const format = String(payload.format || '').toLowerCase();
    if (!['json', 'html'].includes(format)) throw new Error('Unsupported export format.');
    if (!db.getPerson(personId)) throw new Error('Case not found.');
    const report = correlationEngine.generateReport(personId);
    const extension = format === 'html' ? 'html' : 'json';
    const content = format === 'html' ? ReportExporter.toHtml(report) : ReportExporter.toJson(report);
    const defaultName = `osint-case-${personId}-${new Date().toISOString().slice(0, 10)}.${extension}`;
    const saveOptions = {
      title: `Export OSINT case #${personId}`,
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: format === 'html' ? [{ name: 'HTML report', extensions: ['html'] }] : [{ name: 'JSON report', extensions: ['json'] }],
      properties: ['showOverwriteConfirmation', 'createDirectory']
    };
    const selection = mainWindow ? await dialog.showSaveDialog(mainWindow, saveOptions) : await dialog.showSaveDialog(saveOptions);
    if (selection.canceled || !selection.filePath) return { success: true, canceled: true };
    fs.writeFileSync(selection.filePath, content, { encoding: 'utf8', mode: 0o600 });
    return { success: true, canceled: false, fileName: path.basename(selection.filePath) };
  } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('image:analyze-local', async (event, payload = {}) => {
  try {
    assertTrustedSender(event);
    let personId = null;
    if (payload.personId !== null && payload.personId !== undefined && payload.personId !== '') {
      personId = assertPersonId(payload.personId);
      if (!db.getPerson(personId)) throw new Error('Case not found.');
    }

    const options = {
      title: 'Select a local image for metadata analysis',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'heic', 'heif'] }]
    };
    const selection = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
    if (selection.canceled || !selection.filePaths?.length) return { success: true, canceled: true };
    const imagePath = selection.filePaths[0];
    if (!IMAGE_EXTENSIONS.has(path.extname(imagePath).toLowerCase())) throw new Error('Unsupported image file type.');

    const result = await collectors.imageAnalyzer.analyzeImage(personId, imagePath);
    let mediaId = null;
    let evidenceId = null;
    if (personId) {
      const gps = result.exif?.gps || {};
      const hasCoordinates = Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude);
      mediaId = db.addMedia(personId, {
        mediaType: 'image',
        url: `urn:sha256:${result.file.sha256}`,
        localPath: null,
        caption: result.file.name,
        location: hasCoordinates ? `${gps.latitude},${gps.longitude}` : null,
        exifData: { file: result.file, exif: result.exif, localOnly: true },
        facesDetected: 0
      });
      evidenceId = db.addEvidence(personId, {
        sourceName: 'Local file analysis', sourceType: 'local_file', entityType: 'media', entityId: mediaId,
        evidenceType: 'local_image_metadata', sourceUrl: null, status: 'observed', qualityScore: 100,
        observedAt: new Date().toISOString(),
        metadata: {
          fileName: result.file.name, extension: result.file.extension, sizeBytes: result.file.sizeBytes,
          sha256: result.file.sha256, exifAvailable: Boolean(result.exif?.available), hasGps: hasCoordinates,
          caveat: 'The hash and metadata describe the selected local file; they do not establish who created or owns the image.'
        }
      });
    }
    return { success: true, canceled: false, result: { ...result, mediaId: mediaId ? Number(mediaId) : null, evidenceId: evidenceId ? Number(evidenceId) : null } };
  } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('settings:get', async (event) => {
  try {
    assertTrustedSender(event);
    const settings = getRuntimeSettings();
    return {
      success: true,
      settings: {
        hasHibpApiKey: settings.hasHibpApiKey,
        hasBraveApiKey: settings.hasBraveApiKey,
        hasUrlscanApiKey: settings.hasUrlscanApiKey,
        hasVirusTotalApiKey: settings.hasVirusTotalApiKey,
        secureStorageAvailable: secureStorageAvailable(),
        tools: getToolStatus()
      }
    };
  } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('settings:save', async (event, settings) => {
  try {
    assertTrustedSender(event);
    const saved = saveSettings(settings);
    const runtime = getRuntimeSettings();
    collectors.hibp?.setApiKey(runtime.hibpApiKey);
    collectors.braveSearch?.setApiKey(runtime.braveApiKey);
    collectors.passiveEnrichment?.setCredentials(runtime);
    return { success: true, settings: { ...saved, tools: getToolStatus() } };
  } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('open-external', async (event, rawUrl) => {
  try {
    assertTrustedSender(event);
    const url = sanitizeText(rawUrl, 2048);
    if (!isAllowedExternalUrl(url)) throw new Error('Only HTTPS links can be opened.');
    await shell.openExternal(url);
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
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
  try { db?.close(); } catch (error) { console.error('Failed to close database:', error.message); }
});
