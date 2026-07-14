// server/settings.js
// ---------------------------------------------------------------------------
// Operating hours / slot length / booking limits, editable at runtime from
// the admin page. Values live in the `settings` table; anything not yet
// set there falls back to the defaults in server/config.js.
// ---------------------------------------------------------------------------
const { db } = require('./db');
const defaults = require('./config');

const EDITABLE_KEYS = [
  'openHour', 'closeHour', 'slotMinutes', 'maxSlotsPerBooking', 'bookingWindowDays'
];

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const overrides = {};
  rows.forEach((r) => { overrides[r.key] = JSON.parse(r.value); });
  return { ...defaults, ...overrides };
}

function validateSettings(input) {
  const errors = [];
  const openHour = Number(input.openHour);
  const closeHour = Number(input.closeHour);
  const slotMinutes = Number(input.slotMinutes);
  const maxSlotsPerBooking = Number(input.maxSlotsPerBooking);
  const bookingWindowDays = Number(input.bookingWindowDays);

  if (!Number.isInteger(openHour) || openHour < 0 || openHour > 23) errors.push('Open hour must be 0-23.');
  if (!Number.isInteger(closeHour) || closeHour < 1 || closeHour > 24) errors.push('Close hour must be 1-24.');
  if (openHour >= closeHour) errors.push('Open hour must be before close hour.');
  if (![30, 60, 90, 120].includes(slotMinutes)) errors.push('Slot length must be 30, 60, 90 or 120 minutes.');
  if (!Number.isInteger(maxSlotsPerBooking) || maxSlotsPerBooking < 1 || maxSlotsPerBooking > 12) {
    errors.push('Max slots per booking must be 1-12.');
  }
  if (!Number.isInteger(bookingWindowDays) || bookingWindowDays < 1 || bookingWindowDays > 90) {
    errors.push('Booking window must be 1-90 days.');
  }

  return {
    errors,
    clean: { openHour, closeHour, slotMinutes, maxSlotsPerBooking, bookingWindowDays }
  };
}

function updateSettings(partial) {
  const upsert = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  const tx = db.transaction((entries) => {
    entries.forEach(([key, value]) => upsert.run(key, JSON.stringify(value)));
  });
  const entries = EDITABLE_KEYS.filter((k) => k in partial).map((k) => [k, partial[k]]);
  tx(entries);
  return getSettings();
}

module.exports = { getSettings, updateSettings, validateSettings, EDITABLE_KEYS };
