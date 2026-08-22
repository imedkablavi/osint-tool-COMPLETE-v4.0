const BaseCollector = require('./baseCollector');
const { spawn, spawnSync } = require('child_process');

class SherlockCollector extends BaseCollector {
  constructor(db, executable = 'sherlock') {
    super('SherlockCollector', db);
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

  async collect(personId, searchData, options = {}) {
    const username = this.normalizeUsername(searchData?.username);
    if (!username) {
      await this.log(personId, 'WARNING', 'Sherlock skipped: no valid username was provided.');
      return [];
    }

    if (!this.isAvailable()) {
      await this.log(personId, 'WARNING', 'Sherlock is not installed or is not available in PATH.');
      return [];
    }

    await this.log(personId, 'INFO', `Running Sherlock for @${username}.`);

    try {
      const found = await this.runSherlock(username, options.sites || []);
      const results = [];
      const existingUrls = this.existingProfileUrls(personId);

      for (const item of found) {
        const normalizedUrl = this.normalizeProfileUrl(item.url);
        if (!normalizedUrl || existingUrls.has(normalizedUrl)) continue;

        const accountData = {
          platform: item.platform,
          username,
          profileUrl: item.url,
          verified: false,
          confidenceScore: 70,
          additionalData: {
            source: 'Sherlock',
            sourceKind: 'external_username_engine',
            checkMethod: 'sherlock_claimed_status',
            checkedAt: new Date().toISOString(),
            evidenceQuality: 70,
            caveat: 'Sherlock reported the username as claimed. Manual identity verification is still required.'
          }
        };

        const id = this.db.addSocialAccount(personId, accountData);
        existingUrls.add(normalizedUrl);
        results.push({ ...accountData, id: Number(id) });
      }

      await this.log(personId, 'SUCCESS', `Sherlock added ${results.length} new claimed username result(s) after deduplication.`);
      return results;
    } catch (error) {
      await this.log(personId, 'ERROR', `Sherlock failed: ${error.message}`);
      return [];
    }
  }

  runSherlock(username, sites = []) {
    return new Promise((resolve, reject) => {
      const args = [username, '--print-found', '--no-color', '--timeout', '15'];
      for (const site of this.normalizeSites(sites)) args.push('--site', site);

      const child = spawn(this.executable, args, {
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let settled = false;
      const maxBytes = 8 * 1024 * 1024;
      let outputTooLarge = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGTERM');
        reject(new Error('Sherlock timed out after 3 minutes'));
      }, 180000);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString('utf8');
        if (Buffer.byteLength(stdout, 'utf8') > maxBytes) {
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
        reject(error);
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        if (outputTooLarge) {
          reject(new Error('Sherlock output exceeded the safety limit'));
          return;
        }

        const results = this.parseOutput(stdout);
        if (results.length > 0) {
          resolve(results);
          return;
        }
        if (code !== 0) {
          reject(new Error(this.cleanAnsi(stderr).trim().slice(0, 500) || `Sherlock exited with code ${code}`));
          return;
        }
        resolve([]);
      });
    });
  }

  parseOutput(output) {
    const results = [];
    const seen = new Set();

    for (const rawLine of this.cleanAnsi(output).split(/\r?\n/)) {
      const line = rawLine.trim();
      const match = line.match(/^\[\+\]\s+(.+?):\s+(https?:\/\/\S+)/i);
      if (!match) continue;

      const platform = match[1].trim();
      const url = match[2].replace(/[),.;]+$/, '');
      const key = `${platform.toLowerCase()}|${url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ platform, url });
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

  normalizeSites(sites) {
    if (!Array.isArray(sites)) return [];
    return sites
      .map((site) => String(site || '').trim())
      .filter((site) => site && site.length <= 80 && /^[\p{L}\p{N} ._+-]+$/u.test(site))
      .slice(0, 50);
  }

  cleanAnsi(value) {
    return String(value || '').replace(/\u001b\[[0-9;]*m/g, '');
  }
}

module.exports = SherlockCollector;
