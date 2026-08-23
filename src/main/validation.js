'use strict';

function cleanText(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${field} must be text`);
  const clean = value.trim();
  if (!clean || clean.length > maxLength || /[\u0000-\u001F\u007F]/.test(clean)) {
    throw new Error(`${field} is invalid`);
  }
  return clean;
}

function validatePersonInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid investigation input');
  const name = cleanText(input.name, 'Name', 120);
  const email = cleanText(input.email, 'Email', 254);
  const username = cleanText(input.username, 'Username', 64);

  if (!email && !username) throw new Error('Email or username is required');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email is invalid');
  if (username && !/^[\p{L}\p{N}._@+-]+$/u.test(username)) throw new Error('Username is invalid');
  return { name, email, username };
}

function validatePersonId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid investigation identifier');
  return id;
}

function safeError(error) {
  const known = [
    'Invalid investigation input', 'Email or username is required', 'Email is invalid',
    'Username is invalid', 'Invalid investigation identifier', 'Investigation not found'
  ];
  return known.includes(error.message) || /^(Name|Email|Username) (must be text|is invalid)$/.test(error.message)
    ? error.message
    : 'The operation failed. See the redacted application log for details.';
}

module.exports = { validatePersonId, validatePersonInput, safeError };
