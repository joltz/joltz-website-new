// server/session.js
// ---------------------------------------------------------------------------
// Cookie-based login sessions. A random token in an HttpOnly cookie maps to
// a row in `sessions`, which points at a `users` row (with a role of 'user'
// or 'admin'). No external session library needed.
// ---------------------------------------------------------------------------
const crypto = require('crypto');
const { db } = require('./db');

const SESSION_COOKIE = 'jolt_session';
const SESSION_TTL_HOURS = 24 * 7; // 1 week

function cleanExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

function createSession(userId) {
  cleanExpiredSessions();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token, userId, expiresAt.toISOString()
  );
  return { token, maxAgeSeconds: SESSION_TTL_HOURS * 3600 };
}

function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

/** Returns the {id, name, email, role} for a valid session token, or null. */
function getUserForSession(token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, s.expires_at FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function sessionCookieHeader(token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function clearCookieHeader() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

/** Attaches req.user if a valid session cookie is present; never blocks. */
function attachUser(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  req.user = getUserForSession(cookies[SESSION_COOKIE]);
  req.sessionToken = cookies[SESSION_COOKIE] || null;
  next();
}

/** Express middleware: requires any logged-in user, else 401 JSON. */
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  next();
}

/** Express middleware: requires a logged-in user with the 'admin' role. */
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}

module.exports = {
  SESSION_COOKIE,
  createSession,
  destroySession,
  getUserForSession,
  parseCookies,
  sessionCookieHeader,
  clearCookieHeader,
  attachUser,
  requireAuth,
  requireAdmin,
  cleanExpiredSessions
};
