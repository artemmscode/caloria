import { calculatePlan, bmi, bmiCategory } from './nutrition.js';
import { sanitizeUser, verifyTelegramInitData, issueSessionToken } from './auth.service.js';
import { badRequest, notFound } from '../utils/errors.js';
import { safeTimezone } from '../utils/time.js';

const CORE_FIELDS = ['age', 'height', 'weight', 'sex', 'activityLevel', 'goal'];

function withPlan(user, goals) {
  const complete = CORE_FIELDS.every((field) => user[field] != null);
  let plan = null;
  if (complete) {
    plan = calculatePlan({
      age: Number(user.age),
      height: Number(user.height),
      weight: Number(user.weight),
      sex: user.sex,
      activityLevel: user.activityLevel,
      goal: user.goal || 'maintain',
      targetWeight: user.targetWeight == null ? null : Number(user.targetWeight),
      timezone: user.timezone,
    });
  }
  return {
    user: sanitizeUser(user),
    goals: goals || null,
    plan,
    bmi: user.weight && user.height ? Number(bmi(Number(user.weight), Number(user.height)).toFixed(1)) : null,
    bmiCategory: user.weight && user.height ? bmiCategory(bmi(Number(user.weight), Number(user.height))) : null,
  };
}

export async function authenticateWithTelegram({ initData, repository, config }) {
  const telegram = verifyTelegramInitData(initData, config.botToken, config.authMaxAgeSeconds);
  let user = await repository.getUserByTelegramId(telegram.telegramId);
  if (!user) {
    user = await repository.createUser({
      telegramId: telegram.telegramId,
      username: telegram.username,
      firstName: telegram.firstName,
      lastName: telegram.lastName,
      photoUrl: telegram.photoUrl,
      timezone: telegram.timezone,
    });
  } else if (
    user.username !== telegram.username ||
    user.firstName !== telegram.firstName ||
    user.lastName !== telegram.lastName ||
    user.photoUrl !== telegram.photoUrl
  ) {
    user = await repository.updateUser(user.id, {
      username: telegram.username,
      firstName: telegram.firstName,
      lastName: telegram.lastName,
      photoUrl: telegram.photoUrl,
    });
  }
  const token = issueSessionToken(user, config);
  const goals = await repository.getGoals(user.id);
  return { token, ...withPlan(user, goals) };
}

export async function authenticateDev({ repository, config, telegramId = '900000001' }) {
  if (!config.enableDevAuth) {
    throw badRequest('Dev-авторизация отключена');
  }
  let user = await repository.getUserByTelegramId(telegramId);
  if (!user) {
    user = await repository.createUser({
      telegramId,
      username: 'dev_user',
      firstName: 'Тест',
      lastName: 'CALORIA',
      timezone: config.defaultTimezone,
    });
  }
  const token = issueSessionToken(user, config);
  const goals = await repository.getGoals(user.id);
  return { token, ...withPlan(user, goals), devMode: true };
}

export async function getProfile(repository, userId) {
  const user = await repository.getUserById(userId);
  if (!user) throw notFound('Пользователь не найден');
  const goals = await repository.getGoals(userId);
  return withPlan(user, goals);
}

export async function saveProfile(repository, userId, input) {
  const current = await repository.getUserById(userId);
  if (!current) throw notFound('Пользователь не найден');

  const merged = {
    ...current,
    ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)),
  };
  if (merged.timezone) merged.timezone = safeTimezone(merged.timezone, current.timezone || 'Asia/Omsk');

  const missing = CORE_FIELDS.filter((field) => merged[field] == null);
  if (missing.length) {
    throw badRequest('Заполните все обязательные поля профиля', { fields: missing });
  }
  if (Number(merged.age) < 14) {
    throw badRequest(
      'CALORIA не рассчитывает цели для пользователей младше 14 лет. Обратитесь к врачу или нутрициологу.',
      { field: 'age' },
    );
  }

  const plan = calculatePlan({
    age: Number(merged.age),
    height: Number(merged.height),
    weight: Number(merged.weight),
    sex: merged.sex,
    activityLevel: merged.activityLevel,
    goal: merged.goal,
    targetWeight: merged.targetWeight == null ? null : Number(merged.targetWeight),
    timezone: merged.timezone,
  });

  const user = await repository.updateUser(userId, {
    age: Number(merged.age),
    height: Number(merged.height),
    weight: Number(merged.weight),
    targetWeight: merged.targetWeight == null ? null : Number(merged.targetWeight),
    sex: merged.sex,
    activityLevel: merged.activityLevel,
    goal: plan.goal,
    timezone: merged.timezone,
    onboardingCompleted: true,
  });

  const goals = await repository.upsertGoals(userId, {
    calories: plan.calories,
    protein: plan.protein,
    fat: plan.fat,
    carbohydrates: plan.carbohydrates,
    waterMl: plan.waterMl,
  });

  return { ...withPlan(user, goals), plan };
}

export async function updateGoals(repository, userId, input) {
  const user = await repository.getUserById(userId);
  if (!user) throw notFound('Пользователь не найден');
  const plan = calculatePlan(await getPlanningProfile(repository, userId));
  // Manual goals are allowed, but never below the safety floors.
  const safetyFloor = Number(user.age) < 18 ? 1600 : user.sex === 'male' ? 1500 : 1200;
  const calories = Math.max(Number(input.calories), safetyFloor);
  const goals = await repository.upsertGoals(userId, {
    calories,
    protein: Number(input.protein),
    fat: Number(input.fat),
    carbohydrates: Number(input.carbohydrates),
    waterMl: Number(input.waterMl || plan.waterMl),
  });
  return goals;
}

async function getPlanningProfile(repository, userId) {
  const user = await repository.getUserById(userId);
  if (!user) throw notFound('Пользователь не найден');
  return {
    age: Number(user.age),
    height: Number(user.height),
    weight: Number(user.weight),
    sex: user.sex,
    activityLevel: user.activityLevel,
    goal: user.goal || 'maintain',
    targetWeight: user.targetWeight == null ? null : Number(user.targetWeight),
    timezone: user.timezone,
  };
}

export async function getPlanPreview(repository, userId) {
  const user = await repository.getUserById(userId);
  if (!user) throw notFound('Пользователь не найден');
  return calculatePlan(await getPlanningProfile(repository, userId));
}

/** Stateless preview used by onboarding before the user confirms the plan. */
export function previewPlan(input) {
  return calculatePlan({
    age: Number(input.age),
    height: Number(input.height),
    weight: Number(input.weight),
    sex: input.sex,
    activityLevel: input.activityLevel,
    goal: input.goal,
    targetWeight: input.targetWeight == null ? null : Number(input.targetWeight),
    timezone: input.timezone,
  });
}
