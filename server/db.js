// server/db.js
// ---------------------------------------------------------------------------
// SQLite database setup for court bookings. Uses better-sqlite3 (synchronous,
// zero external services — the DB is just a file on disk at server/data.db).
// ---------------------------------------------------------------------------
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS courts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    hourly_rate_cents INTEGER NOT NULL,
    description TEXT,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    court_id INTEGER NOT NULL REFERENCES courts(id),
    user_id INTEGER REFERENCES users(id),
    booking_date TEXT NOT NULL,        -- 'YYYY-MM-DD'
    start_time TEXT NOT NULL,          -- 'HH:MM' 24h
    end_time TEXT NOT NULL,            -- 'HH:MM' 24h
    slot_count INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | expired | canceled
    stripe_session_id TEXT,
    stripe_payment_intent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_court_date
    ON bookings (court_id, booking_date);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Seed courts once, on first run
const courtCount = db.prepare('SELECT COUNT(*) AS n FROM courts').get().n;
if (courtCount === 0) {
  const insert = db.prepare(
    'INSERT INTO courts (name, hourly_rate_cents, description) VALUES (?, ?, ?)'
  );
  const seed = db.transaction((rows) => {
    rows.forEach((r) => insert.run(r.name, r.hourly_rate_cents, r.description));
  });
  seed([
    { name: 'Court 1', hourly_rate_cents: 2500, description: 'Outdoor, lights, tournament lines.' },
    { name: 'Court 2', hourly_rate_cents: 2500, description: 'Outdoor, lights, tournament lines.' },
    { name: 'Court 3', hourly_rate_cents: 2000, description: 'Outdoor, practice wall alongside.' }
  ]);
}

// Bootstrap the first admin account from env vars, once, if no users exist
// yet. After that, admins are managed from the admin panel's Users tab.
const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (userCount === 0 && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const { hashPassword } = require('./password');
  db.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(
    process.env.ADMIN_NAME || 'Admin',
    process.env.ADMIN_EMAIL.toLowerCase().trim(),
    hashPassword(process.env.ADMIN_PASSWORD),
    'admin'
  );
  console.log(`[db] Created initial admin account for ${process.env.ADMIN_EMAIL}`);
}

// Any 'pending' booking older than this is treated as abandoned and no
// longer blocks the slot (the person never finished paying on Stripe).
const PENDING_HOLD_MINUTES = 15;

function releaseStalePending() {
  db.prepare(
    `UPDATE bookings
     SET status = 'expired'
     WHERE status = 'pending'
       AND datetime(created_at, '+${PENDING_HOLD_MINUTES} minutes') < datetime('now')`
  ).run();
}

module.exports = { db, releaseStalePending, PENDING_HOLD_MINUTES };
