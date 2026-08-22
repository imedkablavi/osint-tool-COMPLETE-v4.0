const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const roots = ['src', 'scripts', 'tests'];
const ignored = new Set(['node_modules', 'dist', '.git']);
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    if (entry.isFile() && entry.name.endsWith('.js')) files.push(absolute);
  }
}

for (const relative of roots) {
  const directory = path.join(root, relative);
  if (fs.existsSync(directory)) walk(directory);
}

let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    console.error(`Syntax check failed: ${path.relative(root, file)}`);
    console.error(result.stderr || result.stdout);
  }
}

if (failed) process.exit(1);
console.log(`Syntax check passed for ${files.length} JavaScript files.`);
