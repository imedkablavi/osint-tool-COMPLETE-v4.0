import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(import.meta.dirname, '..', 'dist');
if (!fs.existsSync(dist)) throw new Error('dist/ does not exist; run npm run build or a packaging script first');

const unpacked = fs.readdirSync(dist)
  .filter((name) => name.endsWith('-unpacked'))
  .map((name) => path.join(dist, name));
if (unpacked.length === 0) throw new Error('No unpacked Electron application was produced');

for (const directory of unpacked) {
  const asar = path.join(directory, 'resources', 'app.asar');
  if (!fs.existsSync(asar) || fs.statSync(asar).size < 1_000) {
    throw new Error(`Missing or empty packaged application archive: ${asar}`);
  }
  const executable = fs.readdirSync(directory).find((name) => name === 'OSINT Casebook' || name === 'OSINT Casebook.exe');
  if (!executable) throw new Error(`Packaged executable not found in ${directory}`);
}
console.log(`Package smoke passed (${unpacked.length} unpacked application directory/directories).`);
