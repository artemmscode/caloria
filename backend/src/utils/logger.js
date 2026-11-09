const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[process.env.LOG_LEVEL] || (process.env.NODE_ENV === 'test' ? 50 : 20);

const REDACTED_KEYS = /token|secret|key|authorization|password/i;

function sanitize(value, depth = 0) {
  if (depth > 4 || value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = REDACTED_KEYS.test(key) ? '[redacted]' : sanitize(item, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && /^\d{6,12}:[A-Za-z0-9_-]{20,}$/.test(value)) {
    return '[redacted-bot-token]';
  }
  return value;
}

function write(level, message, meta) {
  if (LEVELS[level] < threshold) return;
  const line = {
    time: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta: sanitize(meta) } : {}),
  };
  const output = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  output(JSON.stringify(line));
}

export const logger = {
  debug: (message, meta) => write('debug', message, meta),
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};
