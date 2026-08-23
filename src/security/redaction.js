'use strict';

const SECRET_KEY_PATTERN = /(api[-_]?key|authorization|cookie|password|secret|token)/i;
const EMAIL_PATTERN = /\b([A-Z0-9._%+-]{1,64})@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
const BEARER_PATTERN = /\b(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi;
const API_KEY_PATTERN = /\b((?:api[-_]?key|token|secret|password)\s*[:=]\s*)[^\s,;]+/gi;

function maskEmail(value) {
  return value.replace(EMAIL_PATTERN, (_match, local, domain) => {
    const prefix = local.length <= 2 ? '*' : `${local[0]}***${local.at(-1)}`;
    return `${prefix}@${domain}`;
  });
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    for (const key of [...url.searchParams.keys()]) {
      if (SECRET_KEY_PATTERN.test(key)) {
        url.searchParams.set(key, '[REDACTED]');
      }
    }
    return url.toString();
  } catch {
    return value;
  }
}

function redactString(value) {
  let result = String(value);
  result = result.replace(BEARER_PATTERN, '$1[REDACTED]');
  result = result.replace(API_KEY_PATTERN, '$1[REDACTED]');
  result = maskEmail(result);
  return result.replace(/https?:\/\/[^\s"'<>]+/gi, redactUrl);
}

function redact(value, seen = new WeakSet()) {
  if (typeof value === 'string') return redactString(value);
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redact(item, seen));

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = SECRET_KEY_PATTERN.test(key) ? '[REDACTED]' : redact(item, seen);
  }
  return output;
}

module.exports = {
  redact,
  redactString,
  redactUrl
};
