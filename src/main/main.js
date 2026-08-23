'use strict';

const path = require('node:path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const DatabaseManager = require('../database/schema');
const SocialMediaCollector = require('../modules/socialMediaCollector');
const HIBPCollector = require('../modules/hibpCollector');
const WhoisCollector = require('../modules/whoisCollector');
const CorrelationEngine = require('../utils/correlationEngine');
const logger = require('../security/logger');
const { validatePersonId, validatePersonInput, safeError } = require('./validation');

let mainWindow = null;
let database = null;
let collectors = null;
let correlation = null;

function isAllowedExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false
    }
  });

  window.removeMenu();
  window.loadFile(path.join(__dirname, '../renderer/index.html'));
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) shell.openExternal(url).catch((error) => logger.warn('External link failed', { message: error.message }));
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });

  if (process.argv.includes('--dev')) window.webContents.openDevTools({ mode: 'detach' });
  window.on('closed', () => { mainWindow = null; });
  return window;
}

function sendUpdate(status, message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('investigation:update', { status, message });
  }
}

function handle(channel, operation) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) {
      return { success: false, error: 'Unauthorized renderer' };
    }
    try {
      return await operation(...args);
    } catch (error) {
      logger.error(`IPC ${channel} failed`, { message: error.message });
      return { success: false, error: safeError(error) };
    }
  });
}

function registerIpcHandlers() {
  handle('person:add', (input) => {
    const person = validatePersonInput(input);
    const personId = database.addPerson(person.name, person.email, person.username);
    return { success: true, personId };
  });

  handle('person:list', () => ({ success: true, persons: database.getAllPersons() }));

  handle('investigation:start', async (rawPersonId) => {
    const personId = validatePersonId(rawPersonId);
    const person = database.getPerson(personId);
    if (!person) throw new Error('Investigation not found');

    sendUpdate('info', 'Checking public profile candidates…');
    await collectors.social.collect(personId, person);
    sendUpdate('info', collectors.hibp.configured ? 'Checking HIBP…' : 'HIBP skipped (API key not configured).');
    await collectors.hibp.collect(personId, person);
    sendUpdate('info', 'Checking RDAP when the email uses a custom domain…');
    await collectors.rdap.collect(personId, person);
    sendUpdate('success', 'Evidence collection finished. Review every candidate manually.');

    return { success: true, report: correlation.generateReport(personId) };
  });

  handle('investigation:report', (rawPersonId) => {
    const personId = validatePersonId(rawPersonId);
    if (!database.getPerson(personId)) throw new Error('Investigation not found');
    return { success: true, report: correlation.generateReport(personId) };
  });

  handle('investigation:delete', (rawPersonId) => {
    const personId = validatePersonId(rawPersonId);
    return { success: database.deletePerson(personId) > 0 };
  });

  handle('app:runtime-config', () => ({
    success: true,
    version: app.getVersion(),
    hibpConfigured: collectors.hibp.configured,
    dataLocation: 'Electron user-data directory'
  }));

  handle('app:open-external', async (url) => {
    if (!isAllowedExternalUrl(url)) throw new Error('External URL is not allowed');
    await shell.openExternal(url);
    return { success: true };
  });
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('io.github.imedkablavi.osintcasebook');
  const databasePath = path.join(app.getPath('userData'), 'data', 'osint.db');
  database = new DatabaseManager(databasePath);
  collectors = {
    social: new SocialMediaCollector(database),
    hibp: new HIBPCollector(database, process.env.HIBP_API_KEY || null),
    rdap: new WhoisCollector(database)
  };
  correlation = new CorrelationEngine(database);
  registerIpcHandlers();
  mainWindow = createWindow();
  logger.info('OSINT Casebook started', { hibpConfigured: collectors.hibp.configured });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
}).catch((error) => {
  logger.error('Application startup failed', { message: error.message });
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (database) database.close();
});

module.exports = { isAllowedExternalUrl };
