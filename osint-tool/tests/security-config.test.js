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
  const renderer = read('src/renderer/renderer.js');
  assert.doesNotMatch(renderer, /require\s*\(/);
  assert.match(renderer, /window\.osintAPI/);
});

test('renderer page carries a restrictive CSP', () => {
  const html = read('src/renderer/index.html');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /object-src 'none'/);
});

test('active and compatibility collectors do not fabricate random breach or RDAP data', () => {
  const breach = read('src/modules/breachCollector.js');
  const hibp = read('src/modules/hibpCollector.js');
  const rdap = read('src/modules/whoisCollector.js');
  assert.doesNotMatch(breach, /Math\.random/);
  assert.doesNotMatch(hibp, /Math\.random/);
  assert.doesNotMatch(rdap, /Math\.random|mockWhoisLookup|Example Registrar/);
});
