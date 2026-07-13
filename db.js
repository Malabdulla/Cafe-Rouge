const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const isPostgres = !!process.env.DATABASE_URL;
let pgPool = null;
let sqliteDb = null;

// Helper: Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
function convertPlaceholders(query) {
  let index = 1;
  return query.replace(/\?/g, () => `$${index++}`);
}

if (isPostgres) {
  console.log('[Database] DATABASE_URL detected. Initializing PostgreSQL pool...');
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  // Initialize Postgres DB Schema
  const initSchema = async () => {
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER UNIQUE NOT NULL,
          status TEXT NOT NULL,
          price REAL NOT NULL,
          tier TEXT NOT NULL,
          gateway_token TEXT,
          agreement_id TEXT,
          next_billing_date TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id)
        )
      `);
      console.log('[Database] PostgreSQL schema verification complete.');
    } catch (err) {
      console.error('[Database] PostgreSQL schema initialization failed:', err);
    }
  };
  initSchema();

} else {
  console.log('[Database] No DATABASE_URL detected. Initializing SQLite...');
  const dbPath = path.resolve(__dirname, 'database.sqlite');
  sqliteDb = new sqlite3.Database(dbPath);

  // Initialize SQLite DB Schema
  sqliteDb.serialize(() => {
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        status TEXT NOT NULL,
        price REAL NOT NULL,
        tier TEXT NOT NULL,
        gateway_token TEXT,
        agreement_id TEXT,
        next_billing_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);
    console.log('[Database] SQLite schema verification complete.');
  });
}

// Unified dbRun function
const dbRun = (query, params = []) => {
  if (isPostgres) {
    return new Promise(async (resolve, reject) => {
      try {
        let pgQuery = convertPlaceholders(query);
        // Automatically append RETURNING id to INSERT statements to fetch lastID
        if (pgQuery.trim().toUpperCase().startsWith('INSERT') && !pgQuery.toUpperCase().includes('RETURNING')) {
          pgQuery += ' RETURNING id';
        }
        const res = await pgPool.query(pgQuery, params);
        resolve({
          lastID: res.rows[0]?.id || null,
          changes: res.rowCount
        });
      } catch (err) {
        reject(err);
      }
    });
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(query, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }
};

// Unified dbGet function (returns single row/undefined)
const dbGet = (query, params = []) => {
  if (isPostgres) {
    return new Promise(async (resolve, reject) => {
      try {
        const pgQuery = convertPlaceholders(query);
        const res = await pgPool.query(pgQuery, params);
        resolve(res.rows[0] || undefined);
      } catch (err) {
        reject(err);
      }
    });
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
};

// Unified dbAll function (returns array of rows)
const dbAll = (query, params = []) => {
  if (isPostgres) {
    return new Promise(async (resolve, reject) => {
      try {
        const pgQuery = convertPlaceholders(query);
        const res = await pgPool.query(pgQuery, params);
        resolve(res.rows);
      } catch (err) {
        reject(err);
      }
    });
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

module.exports = {
  dbRun,
  dbGet,
  dbAll
};
