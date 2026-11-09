import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlan, scaleNutrition, basalMetabolicRate } from '../src/services/nutrition.js';

const adultMale = {
  age: 30,
  height: 180,
  weight: 80,
  sex: 'male',
  activityLevel: 'moderate',
  goal: 'maintain',
  targetWeight: 75,
  timezone: 'Europe/Moscow',
};

test('Mifflin-St Jeor BMR is calculated from sex, weight, height and age', () => {
  assert.equal(basalMetabolicRate(adultMale), 1780);
  assert.equal(
    basalMetabolicRate({ ...adultMale, sex: 'female' }),
    1614,
  );
});

test('maintenance plan is plausible and macros are positive', () => {
  const plan = calculatePlan(adultMale);
  assert.equal(plan.goal, 'maintain');
  assert.ok(plan.calories >= 2300 && plan.calories <= 3000, `calories=${plan.calories}`);
  assert.ok(plan.protein > 0 && plan.fat > 0 && plan.carbohydrates > 0);
  assert.ok(plan.waterMl >= 1500);
  assert.equal(plan.warnings.length, 0);
  assert.match(plan.disclaimer, /не является медицинской рекомендацией/);
});

test('weight-loss plan uses a conservative deficit, not 1 kg per week', () => {
  const plan = calculatePlan({ ...adultMale, goal: 'lose' });
  const expectedLossPerWeek = (plan.tdee - plan.calories) * 7 / 7700;
  assert.ok(expectedLossPerWeek <= 0.5, `loss=${expectedLossPerWeek}`);
  assert.ok(plan.calories >= 1500);
  assert.ok(plan.expectedWeeklyChangeKg < 0, 'loss must be a negative weekly change');
});

test('weight-gain plan reports a positive weekly change', () => {
  const plan = calculatePlan({ ...adultMale, goal: 'gain' });
  assert.ok(plan.expectedWeeklyChangeKg > 0);
});

test('maintenance plan reports no weekly change', () => {
  const plan = calculatePlan(adultMale);
  assert.equal(plan.expectedWeeklyChangeKg, 0);
});

test('under-18 users never receive an automatic deficit', () => {
  const plan = calculatePlan({ ...adultMale, age: 15, goal: 'lose' });
  assert.equal(plan.goal, 'maintain');
  assert.equal(plan.isMinor, true);
  assert.ok(plan.calories >= 1800);
  assert.ok(plan.warnings.some((warning) => /младше 18/.test(warning)));
});

test('underweight user asking to lose weight is redirected to maintenance', () => {
  const plan = calculatePlan({
    ...adultMale,
    weight: 52,
    height: 180,
    goal: 'lose',
  });
  assert.equal(plan.goal, 'maintain');
  assert.ok(plan.warnings.some((warning) => /недостаточная масса тела/i.test(warning)));
});

test('dangerously low target weight produces a warning', () => {
  const plan = calculatePlan({ ...adultMale, targetWeight: 45 });
  assert.ok(plan.warnings.some((warning) => /ниже общепринятого диапазона/.test(warning)));
  assert.equal(plan.bmi, 24.7);
});

test('calorie floor is never violated', () => {
  const plan = calculatePlan({
    age: 70,
    height: 150,
    weight: 45,
    sex: 'female',
    activityLevel: 'sedentary',
    goal: 'lose',
  });
  assert.ok(plan.calories >= 1200);
  assert.ok(plan.warnings.length > 0);
});

test('portion nutrition is scaled from per-100-gram values', () => {
  const banana = { calories: 89, protein: 1.1, fat: 0.3, carbohydrates: 22.8 };
  assert.deepEqual(scaleNutrition(banana, 150), {
    calories: 133.5,
    protein: 1.7,
    fat: 0.5,
    carbohydrates: 34.2,
  });
});
