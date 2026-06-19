// src/utils/time.js
// Helper utilities for handling time zones consistently across the application.
// All dates are stored in the database as UTC. The functions below convert between
// UTC and a configurable default time zone (e.g., the local zone of the competition).

const { utcToZonedTime, zonedTimeToUtc, format } = require('date-fns-tz');

// Default time zone for the application – can be changed via environment variable
// or by passing a custom zone to the helper functions.
const DEFAULT_TZ = process.env.APP_TIMEZONE || 'America/Santiago';

/**
 * Convert a Date (assumed to be in `tz`) to UTC for persistence.
 * @param {Date|string} date - Date object or ISO string.
 * @param {string} [tz=DEFAULT_TZ] - IANA time‑zone identifier.
 * @returns {Date} UTC Date.
 */
function toUTC(date, tz = DEFAULT_TZ) {
  const d = date instanceof Date ? date : new Date(date);
  // Interpret the date as being in the supplied time zone, then convert to UTC.
  const zoned = utcToZonedTime(d, tz);
  return zonedTimeToUtc(zoned, tz);
}

/**
 * Format a UTC Date for display in the target time zone.
 * @param {Date|string} utcDate - Date stored in UTC.
 * @param {string} [tz=DEFAULT_TZ] - Desired output time zone.
 * @param {string} [fmt='yyyy-MM-dd HH:mm:ss XXX'] - date‑fns formatting pattern.
 * @returns {string} Formatted date string.
 */
function formatInTZ(utcDate, tz = DEFAULT_TZ, fmt = "yyyy-MM-dd HH:mm:ss XXX") {
  const d = utcDate instanceof Date ? utcDate : new Date(utcDate);
  const zoned = utcToZonedTime(d, tz);
  return format(zoned, fmt, { timeZone: tz });
}

module.exports = { toUTC, formatInTZ, DEFAULT_TZ };
