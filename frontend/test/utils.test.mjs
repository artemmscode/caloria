import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  clamp,
  escapeHtml,
  formatCalories,
  formatMacro,
  greeting,
  initials,
  mealFromHour,
  parseIsoDate,
  percent,
  plural,
  safeJson,
  signed,
  TIMEZONES,
  todayInZone,
} from '../js/utils.js';

test('escapeHtml neutralises markup and quotes', () => {
  assert.equal(
    escapeHtml(`<script>alert("x")</script> & 'y'`),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#039;y&#039;',
  );
  assert.equal(escapeHtml(undefined), '');
});

test('Russian plural forms cover edge cases', () => {
  const forms = ['день', 'дня', 'дней'];
  const cases = new Map([
    [1, 'день'],
    [2, 'дня'],
    [4, 'дня'],
    [5, 'дней'],
    [11, 'дней'],
    [14, 'дней'],
    [21, 'день'],
    [22, 'дня'],
    [25, 'дней'],
    [101, 'день'],
    [111, 'дней'],
  ]);
  for (const [count, expected] of cases) {
    assert.equal(plural(count, ...forms), expected, `plural(${count})`);
  }
});

test('date arithmetic crosses month and leap-year boundaries', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2024-03-01', -1), '2024-02-29');
  assert.equal(parseIsoDate('2026-07-15').toISOString(), '2026-07-15T12:00:00.000Z');
});

test('todayInZone respects real time zone offsets', () => {
  // UTC+14 and UTC-11 are always on different calendar days.
  assert.notEqual(todayInZone('Pacific/Kiritimati'), todayInZone('Pacific/Midway'));
  assert.match(todayInZone('Europe/Moscow'), /^\d{4}-\d{2}-\d{2}$/);
});

test('calorie and macro formatting stays human readable', () => {
  assert.equal(formatCalories(0), '0');
  assert.equal(formatCalories(-10), '0');
  assert.equal(formatCalories(150.4), '150');
  assert.equal(formatMacro(1.0), '1');
  assert.equal(formatMacro(1.7), '1,7');
});

test('greeting and automatic meal selection use hour boundaries', () => {
  assert.equal(greeting(3), 'Доброй ночи');
  assert.equal(greeting(7), 'Доброе утро');
  assert.equal(greeting(12), 'Добрый день');
  assert.equal(greeting(19), 'Добрый вечер');
  assert.equal(mealFromHour(8), 'breakfast');
  assert.equal(mealFromHour(11), 'lunch');
  assert.equal(mealFromHour(16), 'dinner');
  assert.equal(mealFromHour(22), 'snack');
});

test('small numeric helpers behave predictably', () => {
  assert.equal(clamp(120, 0, 100), 100);
  assert.equal(clamp(-5, 0, 100), 0);
  assert.equal(percent(50, 200), 25);
  assert.equal(percent(50, 0), 0);
  assert.equal(signed(0), '0');
  assert.equal(signed(2.5), '+2,5');
  assert.equal(signed(-2.5), '−2,5');
  assert.equal(initials('Кирилл Иванов'), 'КИ');
  assert.equal(initials(''), '');
  assert.deepEqual(safeJson('{bad', { ok: false }), { ok: false });
  assert.deepEqual(safeJson('{"ok":true}'), { ok: true });
});

test('timezone list contains Russian and neighbouring zones', () => {
  assert.ok(TIMEZONES.includes('Europe/Moscow'));
  assert.ok(TIMEZONES.includes('Asia/Kamchatka'));
  assert.ok(TIMEZONES.includes('Asia/Almaty'));
});