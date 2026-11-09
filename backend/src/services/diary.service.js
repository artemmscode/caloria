import { notFound, badRequest } from '../utils/errors.js';
import { dayRangeUtc, localDate, localTime, zonedDateTimeToUtc, addDays } from '../utils/time.js';
import { nutritionTotals, scaleNutrition } from './nutrition.js';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекусы',
};

export function fallbackGoals() {
  return { calories: 2000, protein: 100, fat: 65, carbohydrates: 230, waterMl: 2000 };
}

export async function getGoalsOrDefault(repository, userId) {
  return (await repository.getGoals(userId)) || fallbackGoals();
}

export async function getEntriesForDate(repository, user, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('Некорректная дата', { field: 'date' });
  const { start, end } = dayRangeUtc(date, user.timezone);
  return repository.listEntries(user.id, start, end);
}

export async function buildDiary(repository, user, date) {
  const [entries, goals] = await Promise.all([
    getEntriesForDate(repository, user, date),
    getGoalsOrDefault(repository, user.id),
  ]);
  const meals = Object.fromEntries(MEAL_TYPES.map((type) => [type, []]));
  for (const entry of entries) {
    (meals[entry.mealType] || meals.snack).push(entry);
  }
  const mealSummaries = MEAL_TYPES.map((type) => ({
    type,
    label: MEAL_LABELS[type],
    entries: meals[type],
    totals: nutritionTotals(meals[type]),
  }));
  const totals = nutritionTotals(entries);
  return {
    date,
    meals: mealSummaries,
    entries,
    totals,
    goals,
    remaining: {
      calories: Math.round(goals.calories - totals.calories),
      protein: Math.round((goals.protein - totals.protein) * 10) / 10,
      fat: Math.round((goals.fat - totals.fat) * 10) / 10,
      carbohydrates: Math.round((goals.carbohydrates - totals.carbohydrates) * 10) / 10,
    },
    mealCount: entries.length,
  };
}

function resolveConsumedAt(date, timeZone, explicitTime) {
  const today = localDate(new Date(), timeZone);
  const time = explicitTime || (date === today ? localTime(new Date(), timeZone) : '12:00');
  return zonedDateTimeToUtc(date, time, timeZone);
}

async function assertProductAccess(repository, userId, productId) {
  const product = await repository.getFoodById(productId);
  if (!product) throw notFound('Продукт не найден');
  if (!product.isPublic && product.createdBy !== userId) {
    throw notFound('Продукт не найден');
  }
  return product;
}

export async function addEntry(repository, user, input) {
  const product = await assertProductAccess(repository, user.id, input.productId);
  const amountGrams = Number(input.amountGrams);
  if (!(amountGrams > 0) || amountGrams > 5000) {
    throw badRequest('Количество должно быть от 1 до 5000 г', { field: 'amountGrams' });
  }
  const date = input.date || localDate(new Date(), user.timezone);
  const consumedAt = resolveConsumedAt(date, user.timezone, input.time);
  const nutrition = scaleNutrition(product, amountGrams);
  const entry = await repository.createEntry({
    userId: user.id,
    productId: product.id,
    productNameSnapshot: product.name,
    mealType: input.mealType,
    amountGrams,
    ...nutrition,
    consumedAt,
    entryDate: date,
  });
  return entry;
}

export async function addEntriesBulk(repository, user, items, { mealType, date, source = 'bot' } = {}) {
  const day = date || localDate(new Date(), user.timezone);
  const consumedAt = resolveConsumedAt(day, user.timezone);
  const rows = [];
  for (const item of items) {
    const product = await assertProductAccess(repository, user.id, item.productId);
    const amountGrams = Number(item.amountGrams);
    rows.push({
      userId: user.id,
      productId: product.id,
      productNameSnapshot: product.name,
      mealType: item.mealType || mealType || mealForLocalTime(localTime(new Date(), user.timezone)),
      amountGrams,
      ...scaleNutrition(product, amountGrams),
      consumedAt,
      entryDate: day,
      source,
    });
  }
  return repository.createEntries(rows);
}

export function mealForLocalTime(time) {
  const [hours] = time.split(':').map(Number);
  if (hours < 11) return 'breakfast';
  if (hours < 16) return 'lunch';
  if (hours < 21) return 'dinner';
  return 'snack';
}

export async function updateEntry(repository, user, entryId, input) {
  const existing = await repository.getEntry(user.id, entryId);
  if (!existing) throw notFound('Запись не найдена');

  const patch = {};
  if (input.mealType) patch.mealType = input.mealType;

  let product = null;
  if (input.productId && input.productId !== existing.productId) {
    product = await assertProductAccess(repository, user.id, input.productId);
    patch.productId = product.id;
    patch.productNameSnapshot = product.name;
  }

  if (input.amountGrams !== undefined) {
    const amount = Number(input.amountGrams);
    if (!(amount > 0) || amount > 5000) {
      throw badRequest('Количество должно быть от 1 до 5000 г', { field: 'amountGrams' });
    }
    const basis = product || (await repository.getFoodById(existing.productId));
    if (!basis) throw notFound('Базовый продукт не найден');
    patch.amountGrams = amount;
    Object.assign(patch, scaleNutrition(basis, amount));
  }

  if (input.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw badRequest('Некорректная дата');
    patch.consumedAt = resolveConsumedAt(input.date, user.timezone, input.time);
    patch.entryDate = input.date;
  } else if (input.time) {
    patch.consumedAt = zonedDateTimeToUtc(existing.entryDate, input.time, user.timezone);
  }

  return repository.updateEntry(user.id, entryId, patch);
}

export async function deleteEntry(repository, user, entryId) {
  const deleted = await repository.deleteEntry(user.id, entryId);
  if (!deleted) throw notFound('Запись не найдена');
  return true;
}

export async function copyDay(repository, user, { fromDate, toDate, mealType = null }) {
  if (fromDate === toDate) throw badRequest('Исходный и новый день совпадают');
  const source = await getEntriesForDate(repository, user, fromDate);
  const filtered = mealType ? source.filter((entry) => entry.mealType === mealType) : source;
  if (!filtered.length) {
    throw badRequest('В выбранном дне нет записей для копирования');
  }
  const created = [];
  for (const entry of filtered) {
    const sourceTime = localTime(new Date(entry.consumedAt), user.timezone);
    created.push(
      await repository.createEntry({
        userId: user.id,
        productId: entry.productId,
        productNameSnapshot: entry.productNameSnapshot,
        mealType: entry.mealType,
        amountGrams: entry.amountGrams,
        calories: entry.calories,
        protein: entry.protein,
        fat: entry.fat,
        carbohydrates: entry.carbohydrates,
        consumedAt: zonedDateTimeToUtc(toDate, sourceTime, user.timezone),
        entryDate: toDate,
      }),
    );
  }
  await repository.incrementFoodUsage(created.map((entry) => entry.productId).filter(Boolean));
  return created;
}

export async function getPreviousDateWithEntries(repository, user, date) {
  for (let offset = 1; offset <= 14; offset += 1) {
    const candidate = addDays(date, -offset);
    const entries = await getEntriesForDate(repository, user, candidate);
    if (entries.length) {
      const meals = MEAL_TYPES.map((type) => {
        const list = entries.filter((entry) => entry.mealType === type);
        return {
          type,
          label: MEAL_LABELS[type],
          count: list.length,
          totals: nutritionTotals(list),
        };
      }).filter((meal) => meal.count > 0);
      return { date: candidate, count: entries.length, meals };
    }
  }
  return null;
}
