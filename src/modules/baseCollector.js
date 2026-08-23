'use strict';

const { createHttpClient } = require('../services/httpClient');
const { redactString } = require('../security/redaction');
const logger = require('../security/logger');

class BaseCollector {
  constructor(name, db, httpClient = null) {
    this.name = name;
    this.db = db;
    this.http = httpClient || createHttpClient();
  }

  async log(personId, status, message) {
    if (this.db) {
      this.db.addLog(personId, this.name, status, redactString(message));
    }
    const level = status === 'ERROR' ? 'error' : status === 'WARNING' ? 'warn' : 'info';
    logger[level](`${this.name}: ${message}`);
  }

  async makeRequest(url, options = {}) {
    return this.http.get(url, options);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  calculateConfidence(factors) {
    let score = 0;
    let totalWeight = 0;

    for (const [factor, weight] of Object.entries(factors)) {
      if (factor) {
        score += weight;
      }
      totalWeight += weight;
    }

    return totalWeight > 0 ? (score / totalWeight) * 100 : 0;
  }

  async collect(personId, searchData) {
    throw new Error('collect() method must be implemented by subclass');
  }
}

module.exports = BaseCollector;
