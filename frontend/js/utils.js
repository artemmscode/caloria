export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatNumber(value, maximumFractionDigits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits }).format(number);
}

export function formatCalories(value) {
  return formatNumber(Math.max(0, Math.round(Number(value) || 0)));
}

export function formatMacro(value) {
  return formatNumber(value, 1).replace(',0', '');
}

export function formatWeight(value) {
  return formatNumber(value, 1).replace(',0', '');
}

export function plural(count, one, few, many) {
  const number = Math.abs(Number(count)) % 100;
  const last = number % 10;
  if (number > 10 && number < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

export function pad(value) {
  return String(value).padStart(2, '0');
}

export function toIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayInZone(timeZone) {
  if (!timeZone) return toIsoDate(new Date());
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  } catch {
    return toIsoDate(new Date());
  }
}

export function addDays(dateString, amount) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(dateString) {
  return new Date(`${dateString}T12:00:00Z`);
}

export function formatDateLong(dateString, { withYear = false } = {}) {
  const date = parseIsoDate(dateString);
  const today = toIsoDate(new Date());
  if (dateString === today) return 'Сегодня';
  if (dateString === addDays(today, -1)) return 'Вчера';
  if (dateString === addDays(today, 1)) return 'Завтра';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(date);
}

export function formatWeekday(dateString, short = true) {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: short ? 'short' : 'long',
    timeZone: 'UTC',
  }).format(parseIsoDate(dateString));
}

export function formatDateShort(dateString) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(parseIsoDate(dateString));
}

export function greeting(hour = new Date().getHours()) {
  if (hour < 5) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function initials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function percent(value, goal) {
  if (!goal) return 0;
  return (Number(value) / Number(goal)) * 100;
}

export function signed(value, digits = 1) {
  const number = Number(value) || 0;
  const formatted = formatNumber(Math.abs(number), digits);
  if (number > 0) return `+${formatted}`;
  if (number < 0) return `−${formatted}`;
  return '0';
}

export function debounce(fn, delay = 280) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function localTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Omsk';
  } catch {
    return 'Asia/Omsk';
  }
}

export const TIMEZONES = [
  'Asia/Omsk',
  'Europe/Moscow',
  'Europe/Kaliningrad',
  'Europe/Samara',
  'Asia/Yekaterinburg',
  'Asia/Omsk',
  'Asia/Novosibirsk',
  'Asia/Krasnoyarsk',
  'Asia/Irkutsk',
  'Asia/Yakutsk',
  'Asia/Vladivostok',
  'Asia/Magadan',
  'Asia/Kamchatka',
  'Europe/Kyiv',
  'Europe/Minsk',
  'Asia/Almaty',
  'Asia/Tbilisi',
  'Asia/Yerevan',
  'Asia/Baku',
  'Asia/Tashkent',
  'Asia/Dubai',
  'Europe/Istanbul',
  'Europe/Belgrade',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Bangkok',
  'Australia/Sydney',
];

export function safeJson(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function mealFromHour(hour = new Date().getHours()) {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export const ACTIVITY_LEVELS = {
  sedentary: {
    factor: 1.2,
    label: 'Минимальная',
    hint: 'Сидячая работа, почти без тренировок',
  },
  light: {
    factor: 1.375,
    label: 'Небольшая',
    hint: '1–2 тренировки в неделю',
  },
  moderate: {
    factor: 1.55,
    label: 'Средняя',
    hint: '3–4 тренировки в неделю',
  },
  active: {
    factor: 1.725,
    label: 'Высокая',
    hint: '5–6 тренировок в неделю',
  },
  very_active: {
    factor: 1.9,
    label: 'Очень высокая',
    hint: 'Ежедневные тренировки или физическая работа',
  },
};

export const GOALS = {
  lose: 'Снижение веса',
  maintain: 'Поддержание',
  gain: 'Набор массы',
};

export const MEAL_LABELS = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекусы',
};

export const MEAL_ICONS = {
  breakfast: 'sunrise',
  lunch: 'sun',
  dinner: 'sunset',
  snack: 'cookie',
};

export const MACRO_META = {
  protein: { label: 'Белки', color: '#FF375F', short: 'Б' },
  fat: { label: 'Жиры', color: '#FF9F0A', short: 'Ж' },
  carbohydrates: { label: 'Углеводы', color: '#0A84FF', short: 'У' },
};
