'use strict';

const net = require('node:net');
const { redactString, redactUrl } = require('../security/redaction');

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function assertPublicHttpUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error('Only HTTPS collector endpoints are allowed');
  }
  if (url.username || url.password) {
    throw new Error('Credentials in collector URLs are not allowed');
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Local collector endpoints are not allowed');
  }

  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4) {
    const octets = hostname.split('.').map(Number);
    const isPrivate = octets[0] === 10 || octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) || octets[0] === 0;
    if (isPrivate) throw new Error('Private collector endpoints are not allowed');
  }
  if (ipVersion === 6 && (hostname === '::1' || hostname.startsWith('fe80:') || hostname.startsWith('fc') || hostname.startsWith('fd'))) {
    throw new Error('Private collector endpoints are not allowed');
  }
  return url;
}

function sanitizeHttpError(error, url) {
  const status = error.response?.status;
  const code = error.code ? ` (${error.code})` : '';
  const statusText = status ? `HTTP ${status}` : 'request failed';
  return new Error(`${statusText}${code} for ${redactUrl(url)}: ${redactString(error.message)}`);
}

function createHttpClient(options = {}) {
  const timeout = boundedInteger(options.timeout ?? process.env.OSINT_HTTP_TIMEOUT_MS, 10_000, 1_000, 60_000);
  const retries = boundedInteger(options.retries ?? process.env.OSINT_HTTP_RETRIES, 2, 0, 3);
  const maximumBytes = 2 * 1024 * 1024;
  const defaultHeaders = {
    'User-Agent': 'OSINT-Casebook/1.1 (+https://github.com/imedkablavi/osint-tool-COMPLETE-v4.0)',
    Accept: 'application/json,text/html;q=0.9,*/*;q=0.5'
  };

  const transport = options.transport || { get: async (initialUrl, config) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeout);
    let currentUrl = initialUrl;
    try {
      for (let redirects = 0; redirects <= 3; redirects += 1) {
        assertPublicHttpUrl(currentUrl);
        const response = await fetch(currentUrl, {
          method: 'GET',
          headers: { ...defaultHeaders, ...(config.headers || {}) },
          redirect: 'manual',
          signal: controller.signal
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location || redirects === 3) throw Object.assign(new Error('Redirect limit exceeded'), { response: { status: response.status } });
          currentUrl = new URL(location, currentUrl).toString();
          continue;
        }

        const declaredLength = Number(response.headers.get('content-length') || 0);
        if (declaredLength > maximumBytes) throw new Error('Provider response exceeded the size limit');
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > maximumBytes) throw new Error('Provider response exceeded the size limit');
        const text = buffer.toString('utf8');
        let data = text;
        if ((response.headers.get('content-type') || '').includes('json')) {
          try { data = text ? JSON.parse(text) : null; } catch { data = null; }
        }
        const result = { status: response.status, data, headers: Object.fromEntries(response.headers.entries()) };
        const accepted = config.validateStatus ? config.validateStatus(response.status) : response.ok;
        if (!accepted) throw Object.assign(new Error(`HTTP ${response.status}`), { response: result });
        return result;
      }
      throw new Error('Redirect limit exceeded');
    } finally {
      clearTimeout(timer);
    }
  } };

  async function get(url, config = {}) {
    assertPublicHttpUrl(url);
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await transport.get(url, { ...config, timeout: config.timeout ?? timeout });
      } catch (error) {
        lastError = error;
        const retryable = !error.response || RETRYABLE_STATUS.has(error.response.status);
        if (!retryable || attempt === retries) break;
        const delay = Math.min(250 * (2 ** attempt), 2_000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw sanitizeHttpError(lastError, url);
  }

  return { get, timeout, retries };
}

module.exports = {
  assertPublicHttpUrl,
  boundedInteger,
  createHttpClient,
  sanitizeHttpError
};
