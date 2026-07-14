// server/slots.js
const { getSettings } = require('./settings');

function pad(n) { return n.toString().padStart(2, '0'); }

/**
 * All possible slots in a day as [{start:'07:00', end:'08:00'}, ...].
 * Reads live settings by default so admin changes to hours/slot length take
 * effect immediately; pass `settingsOverride` to test with fixed values.
 */
function generateDaySlots(settingsOverride) {
  const { openHour, closeHour, slotMinutes } = settingsOverride || getSettings();
  const slots = [];
  const totalMinutes = (closeHour - openHour) * 60;
  for (let m = 0; m < totalMinutes; m += slotMinutes) {
    const startMin = openHour * 60 + m;
    const endMin = startMin + slotMinutes;
    slots.push({
      start: `${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}`,
      end: `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`
    });
  }
  return slots;
}

/** true if a given 'HH:MM' slot on `dateStr` (YYYY-MM-DD) is already in the past */
function isSlotInPast(dateStr, startTime) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  if (dateStr > todayStr) return false;
  if (dateStr < todayStr) return true;
  const [h, m] = startTime.split(':').map(Number);
  const slotDate = new Date(now);
  slotDate.setHours(h, m, 0, 0);
  return slotDate.getTime() <= now.getTime();
}

/** Validate `dateStr` is a real, well-formed YYYY-MM-DD date */
function isValidDateStr(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !Number.isNaN(new Date(dateStr).getTime());
}

module.exports = { generateDaySlots, isSlotInPast, isValidDateStr };
