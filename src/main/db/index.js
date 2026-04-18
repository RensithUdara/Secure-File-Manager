const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const Database = require('better-sqlite3');

let db;

function getDb() {
    if (!db) {
        const dbPath = path.join(app.getPath('userData'), 'vault.db');
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        db = new Database(dbPath);
        migrate(db);
    }

    return db;
}

function migrate(dbInstance) {
    dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      key_salt TEXT,
      profile_image TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS locks (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      entry_path TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      password_hash TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, entry_path)
    );

    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      entry_path TEXT,
      meta TEXT,
      created_at TEXT NOT NULL
    );
  `);

    const userColumns = dbInstance.prepare('PRAGMA table_info(users)').all().map((col) => col.name);
    if (!userColumns.includes('key_salt')) {
        dbInstance.exec('ALTER TABLE users ADD COLUMN key_salt TEXT');
    }
}

module.exports = { getDb };
