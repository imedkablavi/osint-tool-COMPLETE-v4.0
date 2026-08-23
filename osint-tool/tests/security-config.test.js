const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('Electron renderer remains isolated and sandboxed', () => {
  const main = read('src/main/main.js');
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /webSecurity:\s*true/);
  assert.doesNotMatch(main, /nodeIntegration:\s*true/);
  assert.doesNotMatch(main, /contextIsolation:\s*false/);
  assert.doesNotMatch(main, /enableRemoteModule:\s*true/);
});

test('renderer does not import Electron or Node directly', () => {
  const rendererFiles = [
    'src/renderer/renderer.js',
    'src/renderer/local-image-tool.js',
    'src/renderer/brave-settings.js',
    'src/renderer/search-media-view.js'
  ];
  for (const relative of rendererFiles) {
    const renderer = read(relative);
    assert.doesNotMatch(renderer, /require\s*\(/, `${relative} must not import Node/Electron directly`);
  }
  assert.match(read('src/renderer/renderer.js'), /window\.osintAPI/);
});

test('renderer page carries a restrictive CSP', () => {
  const html = read('src/renderer/index.html');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /object-src 'none'/);
});

test('local image selection remains main-process owned', () => {
  const main = read('src/main/main.js');
  const preload = read('src/main/preload.js');
  const renderer = read('src/renderer/local-image-tool.js');
  assert.match(main, /ipcMain\.handle\('image:analyze-local'/);
  assert.match(main, /dialog\.showOpenDialog/);
  assert.match(main, /localPath:\s*null/);
  assert.match(preload, /ipcRenderer\.invoke\('image:analyze-local'/);
  assert.doesNotMatch(preload, /require\(['"]fs['"]\)/);
  assert.doesNotMatch(renderer, /readFile|writeFile|showOpenDialog|require\s*\(/);
});

test('credential-backed enrichment secrets remain main-process encrypted settings', () => {
  const main = read('src/main/main.js');
  const preload = read('src/main/preload.js');
  assert.match(main, /urlscanApiKeyEncrypted/);
  assert.match(main, /virusTotalApiKeyEncrypted/);
  assert.match(main, /safeStorage\.encryptString/);
  assert.match(main, /hasUrlscanApiKey/);
  assert.match(main, /hasVirusTotalApiKey/);
  assert.doesNotMatch(preload, /urlscanApiKey|virusTotalApiKey|hibpApiKey|braveApiKey/);
});

test('urlscan integration is passive search-only and does not submit public scans', () => {
  const urlscan = read('src/modules/urlscanCollector.js');
  assert.match(urlscan, /api\/v1\/search/);
  assert.doesNotMatch(urlscan, /api\/v1\/scan\/?['"`]/);
  assert.doesNotMatch(urlscan, /axios\.post|makeRequest\([^)]*,\s*\{[^}]*method:\s*['"]post/i);
});

test('active and compatibility collectors do not fabricate random evidence', () => {
  const files = [
    'src/modules/breachCollector.js',
    'src/modules/hibpCollector.js',
    'src/modules/whoisCollector.js',
    'src/modules/braveSearchCollector.js',
    'src/modules/waybackCollector.js',
    'src/modules/urlscanCollector.js',
    'src/modules/virusTotalCollector.js',
    'src/modules/ipRdapCollector.js'
  ];
  for (const relative of files) {
    const content = read(relative);
    assert.doesNotMatch(content, /Math\.random|generateMockResults|generateMock/i, `${relative} must not fabricate evidence`);
  }
  assert.doesNotMatch(read('src/modules/whoisCollector.js'), /mockWhoisLookup|Example Registrar/);
});
