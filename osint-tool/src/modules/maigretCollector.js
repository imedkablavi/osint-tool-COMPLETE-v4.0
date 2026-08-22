const BaseCollector = require('./baseCollector');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

class MaigretCollector extends BaseCollector {
  constructor(db, executable = 'maigret') {
    super('MaigretCollector', db);
    this.executable = executable;
  }

  isAvailable() {
    try {
      const result = spawnSync(this.executable, ['--version'], {
        encoding: 'utf8',
        timeout: 5000,
        windowsHide: true
      });
      return result.status === 0;
    } catch {
      return false;
    }
  }

  async collect(personId, searchData) {
    const username = this.normalizeUsername(searchData?.username);
    if (!username) {
      await this.log(personId, 'WARNING', 'Maigret skipped: no valid username was provided.');
      return [];
    }

    if (!this.isAvailable()) {
      await this.log(personId, 'WARNING', 'Maigret is not installed or is not available in PATH.');
      return [];
    }

    await this.log(personId, 'INFO', `Running Maigret machine-readable username search for @${username}.`);

    try {
      const found = await this.runMaigret(username);
      const results = [];
      const existingUrls = this.existingProfileUrls(personId);

      for (const item of found) {
        const normalizedUrl = this.normalizeProfileUrl(item.url);
        if (!normalizedUrl || existingUrls.has(normalizedUrl)) continue;

        const extracted = item.extracted || {};
        const accountData = {
          platform: item.platform,
          username,
          displayName: extracted.fullname || extracted.name || null,
          profileUrl: item.url,
          bio: extracted.bio || extracted.about || extracted.description || null,
          avatarUrl: extracted.image || null,
          followersCount: this.numberOrNull(extracted.followers_count || extracted.followers),
          followingCount: this.numberOrNull(extracted.following_count || extracted.following),
          verified: false,
          lastPostDate: extracted.latest_activity_at || extracted.updated_at || extracted.last_online || null,
          confidenceScore: item.extractedCount > 0 ? 72 : 65,
          additionalData: {
            source: 'Maigret',
            sourceKind: 'external_username_engine',
            checkMethod: 'maigret_simple_json_claimed',
            httpStatus: item.httpStatus,
            tags: item.tags,
            extracted,
            checkedAt: new Date().toISOString(),
            evidenceQuality: item.extractedCount > 0 ? 72 : 65,
            caveat: 'Maigret reported this username as claimed. Maigret documents that false positives can occur; manual verification is required.'
          }
        };

        const id = this.db.addSocialAccount(personId, accountData);
        existingUrls.add(normalizedUrl);
        results.push({ ...accountData, id: Number(id) });
      }

      await this.log(personId, 'SUCCESS', `Maigret added ${results.length} new JSON-backed result(s) after deduplication.`);
      return results;
    } catch (error) {
      await this.log(personId, 'ERROR', `Maigret failed: ${error.message}`);
      return [];
    }
  }

  runMaigret(username) {
    return new Promise((resolve, reject) => {
      const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'osint-maigret-'));
      const reportPath = path.join(outputDir, `report_${username}_simple.json`);
      const args = [
        username,
        '--json', 'simple',
        '--folderoutput', outputDir,
        '--timeout', '15',
        '--retries', '1',
        '--no-color',
        '--no-progressbar'
      ];

      const child = spawn(this.executable, args, {
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdoutBytes = 0;
      let stderr = '';
      let settled = false;
      let outputTooLarge = false;
      const maxBytes = 12 * 1024 * 1024;

      const cleanup = () => {
        try {
          fs.rmSync(outputDir, { recursive: true, force: true });
        } catch {
          // Best-effort cleanup of Maigret's temporary report directory.
        }
      };

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGTERM');
        cleanup();
        reject(new Error('Maigret timed out after 5 minutes'));
      }, 300000);

      child.stdout.on('data', (chunk) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes > maxBytes) {
          outputTooLarge = true;
          child.kill('SIGTERM');
        }
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
        if (Buffer.byteLength(stderr, 'utf8') > maxBytes) {
          outputTooLarge = true;
          child.kill('SIGTERM');
        }
      });
      child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        reject(error);
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        try {
          if (outputTooLarge) throw new Error('Maigret output exceeded the safety limit');
          if (!fs.existsSync(reportPath)) {
            if (code !== 0) {
              throw new Error(this.cleanAnsi(stderr).trim().slice(0, 500) || `Maigret exited with code ${code}`);
            }
            throw new Error('Maigret did not create the expected simple JSON report');
          }

          const raw = fs.readFileSync(reportPath, 'utf8');
          const data = JSON.parse(raw);
          resolve(this.parseSimpleReport(data));
        } catch (error) {
          reject(error);
        } finally {
          cleanup();
        }
      });
    });
  }

  parseSimpleReport(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
    const results = [];

    for (const [platform, entry] of Object.entries(data)) {
      if (!entry || typeof entry !== 'object') continue;
      const url = String(entry.url_user || entry.url || '').trim();
      if (!/^https?:\/\//i.test(url)) continue;

      const status = entry.status || {};
      const extracted = status.ids_data && typeof status.ids_data === 'object'
        ? status.ids_data
        : (entry.ids_data && typeof entry.ids_data === 'object' ? entry.ids_data : {});
      const tags = Array.isArray(status.tags)
        ? status.tags
        : (Array.isArray(entry.tags) ? entry.tags : []);

      results.push({
        platform,
        url,
        httpStatus: Number(entry.http_status) || null,
        tags,
        extracted,
        extractedCount: Object.keys(extracted).length
      });
    }

    return results;
  }

  existingProfileUrls(personId) {
    if (!this.db || typeof this.db.getSocialAccounts !== 'function') return new Set();
    return new Set(
      this.db.getSocialAccounts(personId)
        .map((account) => this.normalizeProfileUrl(account.profile_url))
        .filter(Boolean)
    );
  }

  normalizeProfileUrl(value) {
    try {
      const url = new URL(String(value || ''));
      url.hash = '';
      url.search = '';
      return `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, '')}`.toLowerCase();
    } catch {
      return '';
    }
  }

  normalizeUsername(value) {
    const username = String(value || '').trim().replace(/^@+/, '');
    if (!username || username.length > 120) return '';
    return /^[\p{L}\p{N}._-]+$/u.test(username) ? username : '';
  }

  numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  cleanAnsi(value) {
    return String(value || '').replace(/\u001b\[[0-9;]*m/g, '');
  }
}

module.exports = MaigretCollector;
