/**
 * Evidence-informed, deliberately conservative energy estimates.
 * This is not a medical device and never produces a diagnosis or prescription.
 */

export const SEX_OPTIONS = ['male', 'female', 'other'];

export const ACTIVITY_LEVELS = {
  sedentary: { factor: 1.2, label: 'Минимальная активность', hint: 'Сидячая работа, почти без тренировок' },
  light: { factor: 1.375, label: 'Небольшая активность', hint: '1–2 тренировки в неделю' },
  moderate: { factor: 1.55, label: 'Средняя активность', hint: '3–4 тренировки в неделю' },
  active: { factor: 1.725, label: 'Высокая активность', hint: '5–6 тренировок в неделю' },
  very_active: { factor: 1.9, label: 'Очень высокая', hint: 'Ежедневные тренировки или физическая работа' },
};

export const GOALS = {
  lose: 'Снижение веса',
  maintain: 'Поддержание',
  gain: 'Набор массы',
};

const round = (value, precision = 0) => {
  const power = 10 ** precision;
  return Math.round(value * power) / power;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function basalMetabolicRate({ weight, height, age, sex }) {
  const sexOffset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return 10 * weight + 6.25 * height - 5 * age + sexOffset;
}

export function bmi(weight, height) {
  if (!weight || !height) return null;
  return weight / (height / 100) ** 2;
}

export function bmiCategory(value) {
  if (value == null) return null;
  if (value < 18.5) return 'Ниже нормы';
  if (value < 25) return 'В пределах нормы';
  if (value < 30) return 'Выше нормы';
  return 'Значительно выше нормы';
}

/**
 * Calculates safe daily targets. Under-18 users never receive an automatic
 * calorie deficit; dangerously low targets are clamped and surfaced as warnings.
 */
export function calculatePlan(profile) {
  const {
    age,
    height,
    weight,
    sex,
    activityLevel = 'moderate',
    goal = 'maintain',
    targetWeight = null,
    timezone = 'Asia/Omsk',
  } = profile;

  const warnings = [];
  const isMinor = age < 18;
  const activity = ACTIVITY_LEVELS[activityLevel] || ACTIVITY_LEVELS.moderate;
  const bmr = basalMetabolicRate({ weight, height, age, sex });
  const tdee = bmr * activity.factor;
  const currentBmi = bmi(weight, height);
  let effectiveGoal = goal;
  let requestedDeficit = 0;

  if (goal === 'lose' && isMinor) {
    effectiveGoal = 'maintain';
    warnings.push(
      'Для пользователей младше 18 лет приложение не создаёт автоматический дефицит калорий. ' +
        'Цель по умолчанию — поддержание веса; изменения лучше согласовать с врачом.',
    );
  }

  if (goal === 'lose' && currentBmi != null && currentBmi < 18.5) {
    effectiveGoal = 'maintain';
    warnings.push(
      'При текущем весе недостаточная масса тела. Снижение веса не рекомендуется без консультации специалиста.',
    );
  }

  if (targetWeight != null && height) {
    const targetBmi = bmi(targetWeight, height);
    if (targetBmi < 18.5) {
      warnings.push(
        `Желаемый вес соответствует ИМТ ${round(targetBmi, 1)} — ниже общепринятого диапазона. ` +
          'Рекомендуем обсудить цель со специалистом.',
      );
    }
    const largeChange = Math.abs(weight - targetWeight) > weight * 0.25;
    if (largeChange) {
      warnings.push('Разница между текущим и желаемым весом большая. Безопаснее двигаться небольшими этапами.');
    }
  }

  if (age >= 65) {
    warnings.push(
      'В возрасте 65+ потребности в энергии и белке индивидуальны. Покажите расчёт врачу или нутрициологу.',
    );
  }

  if (sex === 'other') {
    warnings.push('Для расчёта использовано среднее значение формулы. Индивидуальные потребности могут отличаться.');
  }

  let calories = tdee;
  if (effectiveGoal === 'lose') {
    requestedDeficit = tdee * 0.15;
    calories = tdee - requestedDeficit;
    const floor = sex === 'male' ? 1500 : 1200;
    if (calories < floor) {
      calories = floor;
      warnings.push(
        'Дефицит ограничен безопасным минимумом: приложение не назначает очень низкую калорийность. ' +
          'Для более точной стратегии нужна консультация специалиста.',
      );
    }
  } else if (effectiveGoal === 'gain') {
    calories = tdee * 1.1;
  }

  if (isMinor) {
    calories = Math.max(calories, sex === 'male' ? 1800 : 1600);
  }
  calories = Math.round(clamp(calories, 1000, 6000) / 10) * 10;

  // Macros: adequate protein, fats ~27% of energy, remaining energy from carbs.
  const proteinPerKg = effectiveGoal === 'lose' ? 1.6 : effectiveGoal === 'gain' ? 1.8 : 1.4;
  let protein = round(weight * proteinPerKg);
  protein = Math.min(protein, round((calories * 0.4) / 4));
  let fat = round((calories * 0.27) / 9);
  let carbohydrates = round((calories - protein * 4 - fat * 9) / 4);
  if (carbohydrates < 50) {
    carbohydrates = 50;
    const remaining = calories - protein * 4 - carbohydrates * 4;
    fat = Math.max(20, round(remaining / 9));
  }

  // Signed weekly change: negative means expected weight loss, positive means gain.
  const expectedWeeklyChangeKg =
    round(((calories - tdee) * 7) / 7700, 2) || 0;
  if (expectedWeeklyChangeKg < 0 && Math.abs(expectedWeeklyChangeKg) > weight * 0.0075) {
    warnings.push('Темп снижения веса выше 0,75% массы тела в неделю может быть чрезмерным.');
  }

  const waterMl = Math.round(clamp(weight * 30, 1500, 3500) / 50) * 50;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories,
    protein,
    fat,
    carbohydrates,
    fiber: Math.round((calories / 1000) * 14),
    waterMl,
    goal: effectiveGoal,
    requestedGoal: goal,
    expectedWeeklyChangeKg,
    bmi: currentBmi == null ? null : round(currentBmi, 1),
    bmiCategory: bmiCategory(currentBmi),
    activityLevel,
    activityLabel: activity.label,
    timezone,
    isMinor,
    safe: warnings.length === 0,
    warnings: [...new Set(warnings)],
    disclaimer:
      'Расчёт носит ориентировочный характер и не является медицинской рекомендацией. ' +
      'Индивидуальные цели могут требовать консультации врача или нутрициолога.',
  };
}

export function sumNutrition(entries = [], field) {
  return round(entries.reduce((acc, entry) => acc + Number(entry[field] || 0), 0), 1);
}

export function nutritionTotals(entries = []) {
  return {
    calories: Math.round(sumNutrition(entries, 'calories')),
    protein: sumNutrition(entries, 'protein'),
    fat: sumNutrition(entries, 'fat'),
    carbohydrates: sumNutrition(entries, 'carbohydrates'),
  };
}

/** Recalculates per-portion nutrition from per-100g product values. */
export function scaleNutrition(product, grams) {
  const factor = Number(grams) / 100;
  return {
    calories: round(Number(product.calories) * factor, 1),
    protein: round(Number(product.protein) * factor, 1),
    fat: round(Number(product.fat) * factor, 1),
    carbohydrates: round(Number(product.carbohydrates) * factor, 1),
  };
}

export function defaultGoalsForWeight(weight) {
  const calories = 2000;
  return {
    calories,
    protein: round(weight * 1.4),
    fat: round((calories * 0.27) / 9),
    carbohydrates: round((calories - weight * 1.4 * 4 - (calories * 0.27)) / 4),
  };
}
