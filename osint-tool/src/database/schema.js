const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
  constructor(databasePath = null) {
    const resolvedPath = databasePath || path.join(__dirname, '../../data/osint.db');
    const dbDir = path.dirname(resolvedPath);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(resolvedPath);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.initializeTables();
    this.initializeIndexes();
  }

  initializeTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS persons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT,
        username TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS social_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER,
        platform TEXT NOT NULL,
        username TEXT,
        display_name TEXT,
        profile_url TEXT,
        bio TEXT,
        avatar_url TEXT,
        followers_count INTEGER,
        following_count INTEGER,
        verified BOOLEAN DEFAULT 0,
        last_post_date TEXT,
        additional_data TEXT,
        confidence_score REAL DEFAULT 0.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS breaches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER,
        email TEXT NOT NULL,
        breach_name TEXT NOT NULL,
        breach_date TEXT,
        description TEXT,
        data_classes TEXT,
        verified BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS domains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER,
        domain_name TEXT NOT NULL,
        registrar TEXT,
        registrant_name TEXT,
        registrant_email TEXT,
        creation_date TEXT,
        expiration_date TEXT,
        nameservers TEXT,
        additional_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER,
        source_type TEXT NOT NULL,
        source_id INTEGER NOT NULL,
        target_type TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        relation_type TEXT NOT NULL,
        confidence_score REAL DEFAULT 0.0,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER,
        social_account_id INTEGER,
        media_type TEXT NOT NULL,
        url TEXT NOT NULL,
        local_path TEXT,
        caption TEXT,
        post_date TEXT,
        location TEXT,
        exif_data TEXT,
        faces_detected INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
        FOREIGN KEY (social_account_id) REFERENCES social_accounts(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER,
        source TEXT NOT NULL,
        title TEXT,
        url TEXT NOT NULL,
        snippet TEXT,
        date_found TEXT,
        relevance_score REAL DEFAULT 0.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER,
        module_name TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS face_searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_path TEXT NOT NULL,
        image_hash TEXT NOT NULL UNIQUE,
        search_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        results_count INTEGER DEFAULT 0,
        faces_detected INTEGER DEFAULT 0,
        search_engines TEXT,
        metadata TEXT
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS face_search_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_hash TEXT NOT NULL,
        source TEXT NOT NULL,
        url TEXT,
        page_url TEXT,
        title TEXT,
        snippet TEXT,
        confidence REAL DEFAULT 0.0,
        face_match BOOLEAN DEFAULT 1,
        metadata TEXT,
        discovered_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (image_hash) REFERENCES face_searches(image_hash) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS detected_faces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_hash TEXT NOT NULL,
        face_index INTEGER DEFAULT 0,
        x INTEGER,
        y INTEGER,
        width INTEGER,
        height INTEGER,
        confidence REAL DEFAULT 0.0,
        encoding TEXT,
        landmarks TEXT,
        FOREIGN KEY (image_hash) REFERENCES face_searches(image_hash) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS face_comparisons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        face1_hash TEXT NOT NULL,
        face2_hash TEXT NOT NULL,
        similarity_score REAL DEFAULT 0.0,
        match_result BOOLEAN DEFAULT 0,
        comparison_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        algorithm TEXT,
        metadata TEXT
      )
    `);
  }

  initializeIndexes() {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_social_accounts_person_id ON social_accounts(person_id);
      CREATE INDEX IF NOT EXISTS idx_breaches_person_id ON breaches(person_id);
      CREATE INDEX IF NOT EXISTS idx_domains_person_id ON domains(person_id);
      CREATE INDEX IF NOT EXISTS idx_relations_person_id ON relations(person_id);
      CREATE INDEX IF NOT EXISTS idx_logs_person_id_created_at ON logs(person_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_search_results_person_id ON search_results(person_id);
    `);
  }

  addPerson(name, email, username) {
    const stmt = this.db.prepare(`
      INSERT INTO persons (name, email, username)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(name || null, email || null, username || null);
    return result.lastInsertRowid;
  }

  getPerson(id) {
    return this.db.prepare('SELECT * FROM persons WHERE id = ?').get(id);
  }

  getAllPersons() {
    return this.db.prepare('SELECT * FROM persons ORDER BY created_at DESC, id DESC').all();
  }

  deletePerson(id) {
    return this.db.prepare('DELETE FROM persons WHERE id = ?').run(id);
  }

  addSocialAccount(personId, accountData) {
    const stmt = this.db.prepare(`
      INSERT INTO social_accounts
      (person_id, platform, username, display_name, profile_url, bio, avatar_url,
       followers_count, following_count, verified, last_post_date, additional_data, confidence_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      personId,
      accountData.platform,
      accountData.username,
      accountData.displayName || null,
      accountData.profileUrl || null,
      accountData.bio || null,
      accountData.avatarUrl || null,
      accountData.followersCount ?? null,
      accountData.followingCount ?? null,
      accountData.verified ? 1 : 0,
      accountData.lastPostDate || null,
      accountData.additionalData ? JSON.stringify(accountData.additionalData) : null,
      Number(accountData.confidenceScore) || 0
    );
    return result.lastInsertRowid;
  }

  getSocialAccounts(personId) {
    return this.db.prepare('SELECT * FROM social_accounts WHERE person_id = ? ORDER BY id DESC').all(personId);
  }

  addBreach(personId, breachData) {
    const stmt = this.db.prepare(`
      INSERT INTO breaches
      (person_id, email, breach_name, breach_date, description, data_classes, verified)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      personId,
      breachData.email,
      breachData.breachName,
      breachData.breachDate || null,
      breachData.description || null,
      breachData.dataClasses ? JSON.stringify(breachData.dataClasses) : null,
      breachData.verified ? 1 : 0
    );
    return result.lastInsertRowid;
  }

  getBreaches(personId) {
    return this.db.prepare('SELECT * FROM breaches WHERE person_id = ? ORDER BY id DESC').all(personId);
  }

  addDomain(personId, domainData) {
    const stmt = this.db.prepare(`
      INSERT INTO domains
      (person_id, domain_name, registrar, registrant_name, registrant_email,
       creation_date, expiration_date, nameservers, additional_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      personId,
      domainData.domainName,
      domainData.registrar || null,
      domainData.registrantName || null,
      domainData.registrantEmail || null,
      domainData.creationDate || null,
      domainData.expirationDate || null,
      domainData.nameservers ? JSON.stringify(domainData.nameservers) : null,
      domainData.additionalData ? JSON.stringify(domainData.additionalData) : null
    );
    return result.lastInsertRowid;
  }

  getDomains(personId) {
    return this.db.prepare('SELECT * FROM domains WHERE person_id = ? ORDER BY id DESC').all(personId);
  }

  addRelation(personId, relationData) {
    const stmt = this.db.prepare(`
      INSERT INTO relations
      (person_id, source_type, source_id, target_type, target_id, relation_type, confidence_score, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      personId,
      relationData.sourceType,
      relationData.sourceId,
      relationData.targetType,
      relationData.targetId,
      relationData.relationType,
      Number(relationData.confidenceScore) || 0,
      relationData.metadata ? JSON.stringify(relationData.metadata) : null
    );
    return result.lastInsertRowid;
  }

  getRelations(personId) {
    return this.db.prepare('SELECT * FROM relations WHERE person_id = ?').all(personId);
  }

  addLog(personId, moduleName, status, message) {
    this.db.prepare(`
      INSERT INTO logs (person_id, module_name, status, message)
      VALUES (?, ?, ?, ?)
    `).run(personId, moduleName, status, message);
  }

  getLogs(personId) {
    return this.db.prepare('SELECT * FROM logs WHERE person_id = ? ORDER BY created_at DESC, id DESC').all(personId);
  }

  close() {
    if (!this.db || !this.db.open) return;
    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // Best-effort checkpoint during shutdown.
    }
    this.db.close();
  }
}

module.exports = DatabaseManager;
