/** Timezone and date helpers. All diary days are computed in the user's IANA zone. */

const pad = (value) => String(value).padStart(2, '0');

export function isValidTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function safeTimezone(timeZone, fallback = 'Europe/Moscow') {
  return isValidTimeZone(timeZone) ? timeZone : fallback;
}

export function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidTimeString(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function localParts(instant = new Date(), timeZone = 'UTC') {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: parts.weekday,
  };
}

export function localDate(instant = new Date(), timeZone = 'UTC') {
  const p = localParts(instant, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function localTime(instant = new Date(), timeZone = 'UTC') {
  const p = localParts(instant, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function addDays(dateString, amount) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function addMonths(dateString, amount) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, day));
  return date.toISOString().slice(0, 10);
}

function offsetAt(ms, timeZone) {
  const p = localParts(new Date(ms), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - ms;
}

/** Returns UTC ISO bounds for a calendar day in a timezone. End is exclusive. */
export function dayRangeUtc(dateString, timeZone = 'UTC') {
  if (!isValidDateString(dateString)) throw new Error(`Invalid date: ${dateString}`);
  const next = addDays(dateString, 1);
  const solve = (value) => {
    const naive = Date.parse(`${value}T00:00:00.000Z`);
    let offset = offsetAt(naive, timeZone);
    let result = naive - offset;
    offset = offsetAt(result, timeZone);
    result = naive - offset;
    offset = offsetAt(result, timeZone);
    return naive - offset;
  };
  const start = solve(dateString);
  const end = solve(next);
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

export function zonedDateTimeToUtc(dateString, timeString, timeZone = 'UTC') {
  const { start } = dayRangeUtc(dateString, timeZone);
  const [hours, minutes] = timeString.split(':').map(Number);
  return new Date(Date.parse(start) + hours * 3600000 + minutes * 60000).toISOString();
}

export function dateRangeList(startDate, endDate) {
  const result = [];
  let cursor = startDate;
  let guard = 0;
  while (cursor <= endDate && guard < 2000) {
    result.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return result;
}

export function periodRange(period, timeZone = 'UTC', now = new Date()) {
  const today = localDate(now, timeZone);
  const days = { '7d': 7, '30d': 30, '90d': 90 }[period];
  if (period === 'all') return { startDate: null, endDate: today, days: null };
  const span = days || 7;
  return { startDate: addDays(today, -(span - 1)), endDate: today, days: span };
}

export function minutesFromTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isQuietHours(localTimeString, quietStart = '22:00', quietEnd = '08:00') {
  if (!isValidTimeString(localTimeString)) return false;
  const now = minutesFromTime(localTimeString);
  const start = minutesFromTime(quietStart);
  const end = minutesFromTime(quietEnd);
  if (start === end) return false;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

export function humanDate(dateString, timeZone) {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

export function weekdayShort(dateString) {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' }).format(date);
}

export function isToday(dateString, timeZone) {
  return dateString === localDate(new Date(), timeZone);
}
