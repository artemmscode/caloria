import { addDays, dayRangeUtc, localDate, periodRange } from '../utils/time.js';
import { nutritionTotals } from './nutrition.js';
import { buildDiary, fallbackGoals, getGoalsOrDefault } from './diary.service.js';

export async function getDashboard(repository, user, date) {
  const diary = await buildDiary(repository, user, date);
  const [water, weekEntries, recentFoods] = await Promise.all([
    repository.getWater(user.id, date),
    getWeekEntries(repository, user, date),
    repository.recentFoods(user.id, 6),
  ]);

  const week = buildWeekSeries(user, date, weekEntries);
  const streak = await calculateStreak(repository, user, date);
  const goalCalories = diary.goals.calories || fallbackGoals().calories;
  const percent = Math.round((diary.totals.calories / goalCalories) * 100);
  const mealsLogged = diary.meals.filter((meal) => meal.entries.length > 0).length;

  return {
    date,
    user: {
      firstName: user.firstName,
      photoUrl: user.photoUrl,
      timezone: user.timezone,
    },
    goals: diary.goals,
    totals: diary.totals,
    remaining: diary.remaining,
    percent,
    caloriesOver: Math.max(0, diary.totals.calories - goalCalories),
    mealsLogged,
    mealCount: diary.mealCount,
    water: {
      amountMl: water.amountMl,
      goalMl: diary.goals.waterMl || water.goalMl || 2000,
    },
    recentFoods,
    week,
    streak,
    meals: diary.meals.map((meal) => ({
      type: meal.type,
      label: meal.label,
      totals: meal.totals,
      count: meal.entries.length,
    })),
    lastEntryAt: diary.entries.length
      ? diary.entries[diary.entries.length - 1].createdAt
      : null,
  };
}

async function getWeekEntries(repository, user, endDate) {
  const startDate = addDays(endDate, -6);
  const { start } = dayRangeUtc(startDate, user.timezone);
  const { end } = dayRangeUtc(addDays(endDate, 1), user.timezone);
  return repository.listEntries(user.id, start, end);
}

export function buildWeekSeries(user, endDate, entries) {
  const byDate = new Map();
  for (const entry of entries) {
    byDate.set(entry.entryDate, [...(byDate.get(entry.entryDate) || []), entry]);
  }
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(endDate, index - 6);
    const dayEntries = byDate.get(date) || [];
    return {
      date,
      calories: nutritionTotals(dayEntries).calories,
      hasEntries: dayEntries.length > 0,
    };
  });
}

export async function calculateStreak(repository, user, endDate) {
  const startDate = addDays(endDate, -120);
  const { start } = dayRangeUtc(startDate, user.timezone);
  const { end } = dayRangeUtc(addDays(endDate, 1), user.timezone);
  const entries = await repository.listEntries(user.id, start, end);
  const days = new Set(entries.map((entry) => entry.entryDate));
  let cursor = endDate;
  let streak = 0;
  if (!days.has(cursor)) cursor = addDays(cursor, -1);
  while (days.has(cursor) && streak < 365) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return {
    current: streak,
    daysTracked: days.size,
    loggedToday: days.has(endDate),
  };
}

export async function getStatistics(repository, user, period = '30d') {
  const { startDate, endDate, days } = periodRange(period, user.timezone);
  const goals = await getGoalsOrDefault(repository, user.id);
  const effectiveStart = startDate || (await earliestEntryDate(repository, user));
  const rangeStart = effectiveStart || addDays(endDate, -29);
  const { start } = dayRangeUtc(rangeStart, user.timezone);
  const { end } = dayRangeUtc(addDays(endDate, 1), user.timezone);
  const [entries, weights, measurements] = await Promise.all([
    repository.listEntries(user.id, start, end),
    repository.listWeights(user.id, { startDate: rangeStart, endDate }),
    repository.listMeasurements(user.id, { startDate: rangeStart }),
  ]);

  const byDate = new Map();
  for (const entry of entries) {
    byDate.set(entry.entryDate, [...(byDate.get(entry.entryDate) || []), entry]);
  }
  const dates = [];
  const totalDays = days || (effectiveStart ? daysBetween(effectiveStart, endDate) + 1 : 1);
  for (let index = 0; index < totalDays; index += 1) {
    dates.push(addDays(endDate, index - (totalDays - 1)));
  }

  const daily = dates.map((date) => {
    const dayEntries = byDate.get(date) || [];
    const totals = nutritionTotals(dayEntries);
    return {
      date,
      ...totals,
      hasEntries: dayEntries.length > 0,
      meals: new Set(dayEntries.map((entry) => entry.mealType)).size,
    };
  });
  const loggedDays = daily.filter((day) => day.hasEntries);
  const total = nutritionTotals(entries);
  const average = loggedDays.length
    ? {
        calories: Math.round(total.calories / loggedDays.length),
        protein: Math.round((total.protein / loggedDays.length) * 10) / 10,
        fat: Math.round((total.fat / loggedDays.length) * 10) / 10,
        carbohydrates: Math.round((total.carbohydrates / loggedDays.length) * 10) / 10,
      }
    : { calories: 0, protein: 0, fat: 0, carbohydrates: 0 };

  const adherenceDays = daily.filter(
    (day) => day.hasEntries && Math.abs(day.calories - goals.calories) <= goals.calories * 0.15,
  ).length;

  const macroCalories = {
    protein: total.protein * 4,
    fat: total.fat * 9,
    carbohydrates: total.carbohydrates * 4,
  };
  const macroEnergy = macroCalories.protein + macroCalories.fat + macroCalories.carbohydrates;
  const macros = Object.fromEntries(
    Object.entries(macroCalories).map(([key, value]) => [
      key,
      macroEnergy ? Math.round((value / macroEnergy) * 100) : 0,
    ]),
  );

  return {
    period,
    startDate: rangeStart,
    endDate,
    goals,
    daily,
    totals: total,
    average,
    regularity: {
      loggedDays: loggedDays.length,
      totalDays,
      percent: totalDays ? Math.round((loggedDays.length / totalDays) * 100) : 0,
      adherenceDays,
    },
    macros,
    weight: weights.map((item) => ({ date: item.recordedOn, value: item.weight })),
    measurements: measurements.map((item) => ({
      date: item.recordedOn,
      waist: item.waist,
      hips: item.hips,
      chest: item.chest,
    })),
    hasData: entries.length > 0,
  };
}

async function earliestEntryDate(repository, user) {
  const since = addDays(localDate(new Date(), user.timezone), -3650);
  const { start } = dayRangeUtc(since, user.timezone);
  const { end } = dayRangeUtc(addDays(localDate(new Date(), user.timezone), 1), user.timezone);
  const entries = await repository.listEntries(user.id, start, end);
  return entries.length ? entries[0].entryDate : null;
}

function daysBetween(startDate, endDate) {
  return Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000);
}

export async function getProgress(repository, user, { period = '90d' } = {}) {
  const { startDate, endDate } = periodRange(period, user.timezone);
  const [weights, measurements, photos] = await Promise.all([
    repository.listWeights(user.id, { startDate, endDate }),
    repository.listMeasurements(user.id, { startDate }),
    repository.listPhotos(user.id, { startDate }),
  ]);
  const allWeights = weights.length ? weights : await repository.listWeights(user.id);
  const first = allWeights[0] || null;
  const latest = allWeights[allWeights.length - 1] || null;
  const target = user.targetWeight == null ? null : Number(user.targetWeight);
  const currentWeight = latest ? latest.weight : user.weight == null ? null : Number(user.weight);
  const toTarget =
    currentWeight != null && target != null ? Number((currentWeight - target).toFixed(1)) : null;
  const change = first && latest ? Number((latest.weight - first.weight).toFixed(1)) : 0;
  return {
    period,
    currentWeight,
    targetWeight: target,
    startWeight: first ? first.weight : null,
    change,
    toTarget,
    weights: weights.map((item) => ({ id: item.id, date: item.recordedOn, value: item.weight })),
    allWeights: allWeights.map((item) => ({ id: item.id, date: item.recordedOn, value: item.weight })),
    measurements: measurements.map((item) => ({
      id: item.id,
      date: item.recordedOn,
      waist: item.waist,
      hips: item.hips,
      chest: item.chest,
    })),
    photos: photos.map((photo) => ({
      id: photo.id,
      date: photo.recordedOn,
      dataUrl: photo.dataUrl,
      note: photo.note,
    })),
  };
}
