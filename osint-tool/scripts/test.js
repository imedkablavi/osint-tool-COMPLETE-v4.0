const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const testDirectory = path.join(root, 'tests');
const testFiles = fs.readdirSync(testDirectory)
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => path.join(testDirectory, name));

if (testFiles.length === 0) {
  console.error('No *.test.js files found in tests/.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: root,
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
