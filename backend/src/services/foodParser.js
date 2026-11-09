import { normalizeFoodName } from '../utils/foodText.js';
import { scaleNutrition } from './nutrition.js';

const NUMBER_WORDS = {
  один: 1, одну: 1, одна: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5,
  шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10, полтора: 1.5, половина: 0.5,
};

const UNIT_PATTERN =
  '(кг|килограмм[а-яё]*|гр|грамм[а-яё]*|г|мл|миллилитр[а-яё]*|л|литр[а-яё]*|шт|штук[а-яё]*|стакан[а-яё]*|ложк[а-яё]*|ст\\.?\\s*л\\.?|ч\\.?\\s*л\\.?)';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeUnit(unit) {
  if (!unit) return null;
  const value = unit.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
  if (value.startsWith('кг') || value.startsWith('килограмм')) return 'kg';
  if (value === 'л' || value.startsWith('литр')) return 'l';
  if (value.startsWith('мл') || value.startsWith('миллилитр')) return 'ml';
  if (value.startsWith('гр') || value.startsWith('грамм') || value === 'г') return 'g';
  if (value.startsWith('шт') || value.startsWith('штук')) return 'piece';
  if (value.startsWith('стакан')) return 'glass';
  if (value === 'стл' || value.startsWith('ложк')) return 'tbsp';
  if (value === 'чл') return 'tsp';
  return null;
}

function unitToGrams(unit, amount, food) {
  switch (unit) {
    case 'kg':
    case 'l':
      return { grams: amount * 1000, approximate: false, unit: 'kg' };
    case 'g':
    case 'ml':
      return { grams: amount, approximate: unit === 'ml', unit };
    case 'piece': {
      const piece = food.pieceGrams || food.defaultServingGrams || 100;
      return { grams: amount * piece, approximate: true, unit: 'piece' };
    }
    case 'glass':
      return { grams: amount * 200, approximate: true, unit: 'glass' };
    case 'tbsp':
      return { grams: amount * 15, approximate: true, unit: 'tbsp' };
    case 'tsp':
      return { grams: amount * 5, approximate: true, unit: 'tsp' };
    default:
      return null;
  }
}

function parseNumber(text, food) {
  const cleaned = text.replace(/,/g, '.');
  const numberMatches = [
    ...cleaned.matchAll(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${UNIT_PATTERN}?`, 'gi')),
  ];
  if (numberMatches.length) {
    const last = numberMatches[numberMatches.length - 1];
    const amount = Number(last[1]);
    const unit = normalizeUnit(last[2]);
    if (Number.isFinite(amount) && amount > 0) {
      const converted = unitToGrams(unit, amount, food);
      if (converted) return converted;
      if (Number.isInteger(amount) && amount <= 20 && food.pieceGrams) {
        return unitToGrams('piece', amount, food);
      }
      if (Number.isInteger(amount) && amount <= 10) {
        return { grams: amount * (food.defaultServingGrams || 100), approximate: true, unit: 'serving' };
      }
      return { grams: amount, approximate: true, unit: 'g-assumed' };
    }
  }

  const wordPattern = new RegExp(
    `(${Object.keys(NUMBER_WORDS).join('|')})(?:\\s+${UNIT_PATTERN})?`,
    'gi',
  );
  const wordMatches = [...cleaned.matchAll(wordPattern)];
  if (wordMatches.length) {
    const last = wordMatches[wordMatches.length - 1];
    const amount = NUMBER_WORDS[last[1].toLowerCase()];
    const unit = normalizeUnit(last[2]);
    const converted = unitToGrams(unit, amount, food);
    if (converted) return converted;
    if (food.pieceGrams) return unitToGrams('piece', amount, food);
    return { grams: amount * (food.defaultServingGrams || 100), approximate: true, unit: 'serving' };
  }
  return null;
}

function findQuantity(before, after, food) {
  const context = before.slice(-42);
  const lastSegment =
    context
      .split(/\s+(?:и|плюс)\s+|\s*[,;+]\s*/u)
      .filter(Boolean)
      .pop() || context;
  const explicitBefore = parseNumber(lastSegment.slice(-32), food);
  if (explicitBefore) return explicitBefore;

  const spoon = lastSegment.match(
    /(столов(?:ая|ую|ой)?\s+ложк[а-яё]*|ст\.?\s*л\.?|ложк[а-яё]*)\s*$/iu,
  );
  if (spoon) return { grams: 15, approximate: true, unit: 'tbsp' };
  const teaspoon = lastSegment.match(/(чай(?:ная|ную|ной)?\s+ложк[а-яё]*|ч\.?\s*л\.?)\s*$/iu);
  if (teaspoon) return { grams: 5, approximate: true, unit: 'tsp' };
  const glass = lastSegment.match(/стакан[а-яё]*\s*$/iu);
  if (glass) return { grams: 200, approximate: true, unit: 'glass' };

  const afterMatch = after
    .slice(0, 18)
    .match(new RegExp(`^\\s*(?:[—:-]|\\()?\\s*(\\d+(?:[.,]\\d+)?)\\s*${UNIT_PATTERN}?`, 'i'));
  if (afterMatch) {
    const amount = Number(afterMatch[1].replace(',', '.'));
    if (Number.isFinite(amount) && amount > 0) {
      const unit = normalizeUnit(afterMatch[2]);
      const converted = unitToGrams(unit, amount, food);
      if (converted) return converted;
      if (food.pieceGrams) return unitToGrams('piece', amount, food);
      return { grams: amount, approximate: true, unit: 'g-assumed' };
    }
  }

  if (food.pieceGrams) {
    return { grams: food.pieceGrams, approximate: true, unit: 'piece-default', quantity: 1 };
  }
  return { grams: food.defaultServingGrams || 100, approximate: true, unit: 'serving-default', quantity: 1 };
}

const ENDINGS = [
  '', 'а', 'я', 'ы', 'и', 'у', 'ю', 'е', 'ом', 'ем', 'ой', 'ей', 'ов', 'ев',
  'ам', 'ям', 'ах', 'ях', 'ая', 'ое', 'ые', 'ий', 'ого', 'ому', 'ым', 'им', 'их', 'ых', 'о',
];
const ENDING_PATTERN = `(?:${ENDINGS.filter(Boolean).sort((a, b) => b.length - a.length).join('|')})?`;

function matchesForTerm(normalized, term) {
  const variants = new Set([term]);
  if (/[аяоеёиыуюь]$/u.test(term) && term.length > 4) {
    variants.add(term.slice(0, -1));
  }
  const found = [];
  for (const variant of variants) {
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(variant)}${ENDING_PATTERN}(?![\\p{L}\\p{N}])`,
      'gu',
    );
    for (const match of normalized.matchAll(pattern)) {
      found.push({ index: match.index, end: match.index + match[0].length, length: match[0].length });
    }
  }
  return found;
}

function normalizeMessage(text) {
  return String(text)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}.,]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Parses free-form Russian text such as «Съела 2 яйца и 100 грамм хлеба».
 * Returns matched products with portion nutrition; never writes to the diary.
 */
export function parseFoodMessage(text, foods) {
  const normalized = normalizeMessage(text);
  const candidates = [];

  for (const food of foods) {
    const terms = new Set(
      [food.name, ...(food.aliases || [])]
        .map((term) => normalizeFoodName(term))
        .filter((term) => term.length >= 3),
    );
    for (const term of terms) {
      for (const match of matchesForTerm(normalized, term)) {
        candidates.push({ food, term, ...match });
      }
    }
  }

  candidates.sort((a, b) => a.index - b.index || b.length - a.length);

  const selected = [];
  let lastEnd = -1;
  for (const candidate of candidates) {
    if (candidate.index < lastEnd) continue;
    selected.push(candidate);
    lastEnd = candidate.end;
  }

  const merged = new Map();
  for (const candidate of selected) {
    const before = normalized.slice(Math.max(0, candidate.index - 32), candidate.index);
    const after = normalized.slice(candidate.end, candidate.end + 18);
    const quantity = findQuantity(before, after, candidate.food);
    const amountGrams = Math.max(1, Math.min(5000, Math.round(quantity.grams)));
    const key = candidate.food.id;
    if (merged.has(key)) {
      merged.get(key).amountGrams += amountGrams;
    } else {
      merged.set(key, {
        productId: candidate.food.id,
        name: candidate.food.name,
        amountGrams,
        approximate: quantity.approximate,
        matchedText: normalized.slice(candidate.index, candidate.end),
        food: candidate.food,
      });
    }
  }

  const items = [...merged.values()].map(({ food, ...item }) => ({
    ...item,
    ...scaleNutrition(food, item.amountGrams),
    emoji: food.emoji,
    source: food.source,
  }));

  const totals = items.reduce(
    (acc, item) => ({
      calories: Math.round(acc.calories + item.calories),
      protein: Math.round((acc.protein + item.protein) * 10) / 10,
      fat: Math.round((acc.fat + item.fat) * 10) / 10,
      carbohydrates: Math.round((acc.carbohydrates + item.carbohydrates) * 10) / 10,
    }),
    { calories: 0, protein: 0, fat: 0, carbohydrates: 0 },
  );

  return { items, totals, approximate: items.some((item) => item.approximate) };
}

export function describeParse(items) {
  return items
    .map(
      (item) =>
        `${item.emoji || '•'} ${item.name} — ${Math.round(item.amountGrams)} г` +
        (item.approximate ? ' (порция примерно)' : ''),
    )
    .join('\n');
}
