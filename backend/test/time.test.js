import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  dateRangeList,
  dayRangeUtc,
  isQuietHours,
  localDate,
  localTime,
  periodRange,
  zonedDateTimeToUtc,
  isValidTimeZone,
} from '../src/utils/time.js';
import { dueReminders } from '../src/services/reminder.service.js';

test('day bounds are correct for Europe/Moscow (UTC+3)', () => {
  const { start, end } = dayRangeUtc('2026-03-10', 'Europe/Moscow');
  assert.equal(start, '2026-03-09T21:00:00.000Z');
  assert.equal(end, '2026-03-10T21:00:00.000Z');
});

test('day bounds account for daylight saving time', () => {
  const before = dayRangeUtc('2026-03-28', 'Europe/Berlin');
  const after = dayRangeUtc('2026-03-29', 'Europe/Berlin');
  assert.equal(before.start, '2026-03-27T23:00:00.000Z');
  assert.equal(after.start, '2026-03-28T23:00:00.000Z');
  assert.equal(
    Date.parse(after.end) - Date.parse(after.start),
    23 * 60 * 60 * 1000,
    'DST transition day has 23 hours',
  );
});

test('timezone conversions round-trip', () => {
  const utc = zonedDateTimeToUtc('2026-07-01', '12:30', 'Asia/Tokyo');
  assert.equal(utc, '2026-07-01T03:30:00.000Z');
  assert.equal(localDate(new Date(utc), 'Asia/Tokyo'), '2026-07-01');
  assert.equal(localTime(new Date(utc), 'Asia/Tokyo'), '12:30');
});

test('date helpers handle month and year boundaries', () => {
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.deepEqual(dateRangeList('2026-02-27', '2026-03-01'), [
    '2026-02-27',
    '2026-02-28',
    '2026-03-01',
  ]);
});

test('period ranges are inclusive and anchored to local today', () => {
  const range = periodRange('7d', 'Europe/Moscow', new Date('2026-03-10T12:00:00Z'));
  assert.equal(range.startDate, '2026-03-04');
  assert.equal(range.endDate, '2026-03-10');
  assert.equal(range.days, 7);
});

test('quiet hours wrap around midnight', () => {
  assert.equal(isQuietHours('23:30', '22:00', '08:00'), true);
  assert.equal(isQuietHours('07:30', '22:00', '08:00'), true);
  assert.equal(isQuietHours('12:00', '22:00', '08:00'), false);
  assert.equal(isQuietHours('08:00', '22:00', '08:00'), false);
});

test('timezone validation rejects nonsense', () => {
  assert.equal(isValidTimeZone('Europe/Moscow'), true);
  assert.equal(isValidTimeZone('Mars/Olympus'), false);
});

test('reminder scheduler finds only due reminders and respects quiet hours', () => {
  const now = new Date('2026-03-10T07:35:00Z'); // 10:35 MSK
  const settings = {
    remindersEnabled: true,
    morningEnabled: true,
    breakfastEnabled: true,
    lunchEnabled: true,
    dinnerEnabled: true,
    eveningEnabled: true,
    waterEnabled: false,
    morningTime: '09:00',
    breakfastTime: '10:30',
    lunchTime: '13:30',
    dinnerTime: '19:00',
    eveningTime: '21:00',
    quietStart: '22:00',
    quietEnd: '08:00',
    timezone: 'Europe/Moscow',
  };
  const result = dueReminders(settings, now, 10);
  assert.equal(result.date, '2026-03-10');
  assert.equal(result.time, '10:35');
  assert.equal(result.quiet, false);
  assert.deepEqual(result.due.map((item) => item.type), ['breakfast']);
  assert.equal(result.due[0].dedupeKey, 'breakfast-2026-03-10-10:30');
});

test('reminder scheduler does not fire twice outside the catch-up window', () => {
  const settings = {
    remindersEnabled: true,
    breakfastEnabled: true,
    breakfastTime: '10:30',
    quietStart: '22:00',
    quietEnd: '08:00',
    timezone: 'Europe/Moscow',
  };
  const late = dueReminders(settings, new Date('2026-03-10T09:00:00Z'), 10); // 12:00 MSK
  assert.equal(late.due.length, 0);
});

test('reminder scheduler is silent at night', () => {
  const settings = {
    remindersEnabled: true,
    eveningEnabled: true,
    eveningTime: '21:00',
    quietStart: '22:00',
    quietEnd: '08:00',
    timezone: 'Europe/Moscow',
  };
  const night = dueReminders(settings, new Date('2026-03-10T20:00:00Z'), 10); // 23:00 MSK
  assert.equal(night.quiet, true);
  assert.equal(night.due.length, 0);
});
