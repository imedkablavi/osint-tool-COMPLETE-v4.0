'use strict';

const { redact } = require('./redaction');

function write(level, message, metadata) {
  const safeMessage = redact(message);
  const safeMetadata = metadata === undefined ? undefined : redact(metadata);
  const suffix = safeMetadata === undefined ? '' : ` ${JSON.stringify(safeMetadata)}`;
  const line = `[${level}] ${safeMessage}${suffix}`;

  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
}

module.exports = {
  info: (message, metadata) => write('INFO', message, metadata),
  warn: (message, metadata) => write('WARN', message, metadata),
  error: (message, metadata) => write('ERROR', message, metadata)
};
