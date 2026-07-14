// server/routes/auth.js
const express = require('express');
const { db } = require('../db');
const { hashPassword, verifyPassword } = require('../password');
const { isEmail } = require('../validate');
const {
  createSession, destroySession, sessionCookieHeader, clearCookieHeader
} = require('../session');

const router = express.Router();

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required.' });
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!isEmail(cleanEmail)) return res.status(400).json({ error: 'A valid email is required.' });
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists. Try logging in.' });

  const result = db.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(String(name).trim(), cleanEmail, hashPassword(password), 'user');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  const { token, maxAgeSeconds } = createSession(user.id);
  res.setHeader('Set-Cookie', sessionCookieHeader(token, maxAgeSeconds));
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
  if (!user || !verifyPassword(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  const { token, maxAgeSeconds } = createSession(user.id);
  res.setHeader('Set-Cookie', sessionCookieHeader(token, maxAgeSeconds));
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  destroySession(req.sessionToken);
  res.setHeader('Set-Cookie', clearCookieHeader());
  res.json({ ok: true });
});

module.exports = router;
