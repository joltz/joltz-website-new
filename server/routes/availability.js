// server/routes/availability.js
const express = require('express');
const { db, releaseStalePending } = require('../db');
const { generateDaySlots, isSlotInPast, isValidDateStr } = require('../slots');
const { getSettings } = require('../settings');

const router = express.Router();

router.get('/', (req, res) => {
  const courtId = Number(req.query.courtId);
  const date = String(req.query.date || '');

  if (!courtId) return res.status(400).json({ error: 'courtId is required' });
  if (!isValidDateStr(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });

  const { bookingWindowDays } = getSettings();
  const today = new Date().toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + bookingWindowDays * 86400000).toISOString().slice(0, 10);
  if (date < today || date > maxDate) {
    return res.status(400).json({ error: `date must be between ${today} and ${maxDate}` });
  }

  const court = db.prepare('SELECT * FROM courts WHERE id = ? AND active = 1').get(courtId);
  if (!court) return res.status(404).json({ error: 'Court not found' });

  releaseStalePending();

  const taken = db
    .prepare(
      `SELECT start_time, end_time FROM bookings
       WHERE court_id = ? AND booking_date = ? AND status IN ('pending', 'paid')`
    )
    .all(courtId, date);

  const slots = generateDaySlots().map((slot) => {
    const overlapsBooking = taken.some((b) => slot.start < b.end_time && b.start_time < slot.end);
    const past = isSlotInPast(date, slot.start);
    return {
      start: slot.start,
      end: slot.end,
      available: !overlapsBooking && !past
    };
  });

  res.json({
    court: { id: court.id, name: court.name, hourlyRateCents: court.hourly_rate_cents },
    date,
    slots
  });
});

module.exports = router;
