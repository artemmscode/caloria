export function normalizeFoodName(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function buildSearchText(name, aliases = []) {
  return normalizeFoodName([name, ...(aliases || [])].join(' '));
}

export function parseFoodQuery(value = '') {
  return String(value).trim().slice(0, 100);
}
