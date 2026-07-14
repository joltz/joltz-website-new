// server/routes/admin.js
const express = require('express');
const { db, releaseStalePending } = require('../db');
const { getSettings, updateSettings, validateSettings } = require('../settings');

const router = express.Router();

// ---- Settings --------------------------------------------------------------
router.get('/settings', (req, res) => {
  res.json({ settings: getSettings() });
});

router.put('/settings', (req, res) => {
  const { errors, clean } = validateSettings(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  const settings = updateSettings(clean);
  res.json({ settings });
});

// ---- Courts ------------------------------------------------------------------
router.get('/courts', (req, res) => {
  const courts = db.prepare('SELECT * FROM courts ORDER BY id').all();
  res.json({ courts });
});

router.post('/courts', (req, res) => {
  const { name, hourlyRateCents, description } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Court name is required.' });
  const rate = Number(hourlyRateCents);
  if (!Number.isInteger(rate) || rate <= 0) return res.status(400).json({ error: 'Hourly rate must be a positive number of cents.' });

  const result = db
    .prepare('INSERT INTO courts (name, hourly_rate_cents, description, active) VALUES (?, ?, ?, 1)')
    .run(String(name).trim(), rate, description ? String(description).trim() : null);

  const court = db.prepare('SELECT * FROM courts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ court });
});

router.put('/courts/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM courts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Court not found.' });

  const name = req.body.name !== undefined ? String(req.body.name).trim() : existing.name;
  const description = req.body.description !== undefined
    ? (req.body.description ? String(req.body.description).trim() : null)
    : existing.description;
  const active = req.body.active !== undefined ? (req.body.active ? 1 : 0) : existing.active;

  let hourlyRateCents = existing.hourly_rate_cents;
  if (req.body.hourlyRateCents !== undefined) {
    const rate = Number(req.body.hourlyRateCents);
    if (!Number.isInteger(rate) || rate <= 0) return res.status(400).json({ error: 'Hourly rate must be a positive number of cents.' });
    hourlyRateCents = rate;
  }
  if (!name) return res.status(400).json({ error: 'Court name is required.' });

  db.prepare(
    'UPDATE courts SET name = ?, hourly_rate_cents = ?, description = ?, active = ? WHERE id = ?'
  ).run(name, hourlyRateCents, description, active, id);

  const court = db.prepare('SELECT * FROM courts WHERE id = ?').get(id);
  res.json({ court });
});

// Soft delete only — bookings reference court_id, so we deactivate rather
// than remove the row and lose booking history.
router.delete('/courts/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM courts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Court not found.' });
  db.prepare('UPDATE courts SET active = 0 WHERE id = ?').run(id);
  res.json({ court: db.prepare('SELECT * FROM courts WHERE id = ?').get(id) });
});

// ---- Bookings / payments ------------------------------------------------------
router.get('/bookings', (req, res) => {
  releaseStalePending();

  const { status, courtId, from, to } = req.query;
  const clauses = [];
  const params = [];

  if (status) { clauses.push('b.status = ?'); params.push(String(status)); }
  if (courtId) { clauses.push('b.court_id = ?'); params.push(Number(courtId)); }
  if (from) { clauses.push('b.booking_date >= ?'); params.push(String(from)); }
  if (to) { clauses.push('b.booking_date <= ?'); params.push(String(to)); }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const bookings = db
    .prepare(
      `SELECT b.*, c.name AS court_name FROM bookings b
       JOIN courts c ON c.id = b.court_id
       ${where}
       ORDER BY b.booking_date DESC, b.start_time DESC`
    )
    .all(...params);

  const today = new Date().toISOString().slice(0, 10);
  const summary = {
    totalPaidCents: db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS n FROM bookings WHERE status = 'paid'").get().n,
    paidCount: db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE status = 'paid'").get().n,
    pendingCount: db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE status = 'pending'").get().n,
    todayCount: db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE booking_date = ? AND status = 'paid'").get(today).n,
    upcomingCount: db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE booking_date >= ? AND status = 'paid'").get(today).n
  };

  res.json({ bookings, summary });
});

// ---- Users & roles -------------------------------------------------------------
router.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY id').all();
  res.json({ users });
});

router.put('/users/:id/role', (req, res) => {
  const id = Number(req.params.id);
  const role = req.body && req.body.role;
  if (role !== 'user' && role !== 'admin') {
    return res.status(400).json({ error: "Role must be 'user' or 'admin'." });
  }

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'User not found.' });

  // Don't allow demoting the last remaining admin — that would lock
  // everyone out of the admin panel.
  if (target.role === 'admin' && role === 'user') {
    const adminCount = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
    if (adminCount <= 1) {
      return res.status(400).json({ error: "Can't remove the last admin account." });
    }
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(id);
  res.json({ user });
});

module.exports = router;
