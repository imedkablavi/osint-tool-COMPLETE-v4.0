import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const ignored = new Set(['.git', 'node_modules', 'dist', 'coverage']);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignored.has(entry.name)) return [];
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const files = walk(root);
const sourceFiles = files.filter((file) => file.endsWith('.js'));
for (const file of sourceFiles) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

const scans = [
  { pattern: /nodeIntegration\s*:\s*true/, message: 'nodeIntegration must remain disabled' },
  { pattern: /contextIsolation\s*:\s*false/, message: 'contextIsolation must remain enabled' },
  { pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/, message: 'GitHub token-like value found' },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/, message: 'AWS access-key-like value found' },
  { pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/, message: 'API secret-like value found' }
];

const textFiles = files.filter((file) => !/\.(?:png|jpg|jpeg|gif|ico|db|sqlite|lock)$/i.test(file));
const failures = [];
for (const file of textFiles) {
  const contents = fs.readFileSync(file, 'utf8');
  for (const scan of scans) {
    if (scan.pattern.test(contents)) failures.push(`${path.relative(root, file)}: ${scan.message}`);
  }
}

const forbiddenDataFiles = files.filter((file) => /\.(?:db|sqlite|sqlite3|log)$/i.test(file));
if (forbiddenDataFiles.length) failures.push('Investigation database or log file is present in the repository');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Source checks passed (${sourceFiles.length} JavaScript files checked).`);
