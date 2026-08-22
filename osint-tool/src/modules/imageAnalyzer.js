const BaseCollector = require('./baseCollector');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

/**
 * Local image evidence analyzer.
 *
 * The commercial pipeline does not upload investigator images to third-party
 * reverse-search services automatically. This module only analyzes a local
 * file and optionally reads EXIF through exiftool when it is installed.
 */
class ImageAnalyzer extends BaseCollector {
  constructor(db, exiftoolExecutable = 'exiftool') {
    super('ImageAnalyzer', db);
    this.exiftoolExecutable = exiftoolExecutable;
  }

  async analyzeImage(personId, imagePath) {
    const resolvedPath = this.validateLocalPath(imagePath);
    await this.caseLog(personId, 'INFO', `Analyzing local image evidence: ${path.basename(resolvedPath)}`);

    const stat = fs.statSync(resolvedPath);
    const result = {
      success: true,
      localOnly: true,
      file: {
        name: path.basename(resolvedPath),
        extension: path.extname(resolvedPath).toLowerCase(),
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        sha256: await this.hashFile(resolvedPath)
      },
      exif: null,
      reverseSearch: {
        available: false,
        results: [],
        reason: 'Automatic third-party reverse-image upload is disabled until an audited provider adapter is configured.'
      }
    };

    if (this.isExifToolAvailable()) {
      try {
        result.exif = await this.extractExif(resolvedPath);
        await this.caseLog(personId, 'SUCCESS', 'Local EXIF metadata extracted with exiftool.');
      } catch (error) {
        result.exif = { available: false, error: error.message };
        await this.caseLog(personId, 'WARNING', `EXIF extraction failed: ${error.message}`);
      }
    } else {
      result.exif = {
        available: false,
        error: 'exiftool is not installed or is not available in PATH.'
      };
      await this.caseLog(personId, 'WARNING', 'EXIF metadata skipped because exiftool is unavailable.');
    }

    return result;
  }

  async caseLog(personId, status, message) {
    const numericId = Number(personId);
    if (Number.isSafeInteger(numericId) && numericId > 0) {
      await this.log(numericId, status, message);
      return;
    }
    console.log(`[${this.name}] ${status}: ${message}`);
  }

  validateLocalPath(inputPath) {
    const value = String(inputPath || '').trim();
    if (!value) throw new Error('A local image path is required.');
    if (/^https?:\/\//i.test(value)) {
      throw new Error('Remote image URLs are not accepted by the local analyzer. Download and review the file explicitly first.');
    }

    const resolved = path.resolve(value);
    if (!fs.existsSync(resolved)) throw new Error('Image file does not exist.');
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) throw new Error('Image path must point to a file.');
    if (stat.size <= 0) throw new Error('Image file is empty.');
    if (stat.size > 100 * 1024 * 1024) throw new Error('Image file exceeds the 100 MB analysis limit.');
    return resolved;
  }

  isExifToolAvailable() {
    try {
      const result = spawnSync(this.exiftoolExecutable, ['-ver'], {
        encoding: 'utf8',
        timeout: 5000,
        windowsHide: true
      });
      return result.status === 0;
    } catch {
      return false;
    }
  }

  hashFile(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  extractExif(filePath) {
    return new Promise((resolve, reject) => {
      const child = spawn(this.exiftoolExecutable, ['-json', '-n', '--', filePath], {
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGTERM');
        reject(new Error('exiftool timed out'));
      }, 15000);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString('utf8');
        if (Buffer.byteLength(stdout, 'utf8') > 5 * 1024 * 1024) child.kill('SIGTERM');
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
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
        if (code !== 0) {
          reject(new Error(stderr.trim().slice(0, 500) || `exiftool exited with code ${code}`));
          return;
        }

        try {
          const rows = JSON.parse(stdout);
          const raw = Array.isArray(rows) ? rows[0] || {} : {};
          resolve(this.normalizeExif(raw));
        } catch {
          reject(new Error('exiftool returned invalid JSON'));
        }
      });
    });
  }

  normalizeExif(raw = {}) {
    return {
      available: true,
      camera: {
        make: raw.Make || null,
        model: raw.Model || null,
        software: raw.Software || null,
        lens: raw.LensModel || raw.Lens || null
      },
      image: {
        width: raw.ImageWidth || raw.ExifImageWidth || null,
        height: raw.ImageHeight || raw.ExifImageHeight || null,
        orientation: raw.Orientation || null,
        mimeType: raw.MIMEType || null
      },
      capture: {
        dateTimeOriginal: raw.DateTimeOriginal || null,
        createDate: raw.CreateDate || null,
        exposureTime: raw.ExposureTime || null,
        fNumber: raw.FNumber || null,
        iso: raw.ISO || null,
        focalLength: raw.FocalLength || null
      },
      gps: {
        latitude: Number.isFinite(Number(raw.GPSLatitude)) ? Number(raw.GPSLatitude) : null,
        longitude: Number.isFinite(Number(raw.GPSLongitude)) ? Number(raw.GPSLongitude) : null,
        altitude: Number.isFinite(Number(raw.GPSAltitude)) ? Number(raw.GPSAltitude) : null
      },
      raw
    };
  }
}

module.exports = ImageAnalyzer;
