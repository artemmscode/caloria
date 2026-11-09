import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupApp } from './helpers.js';
import { addDays, localDate } from '../src/utils/time.js';

async function login(app, telegramId = '900000001') {
  const response = await request(app)
    .post('/api/auth/dev')
    .send({ telegramId });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return { token: response.body.data.token, user: response.body.data.user };
}

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

test('full API integration: onboarding, diary, stats, weight, water, reminders', async () => {
  const { app, repository } = await setupApp();
  const { token, user } = await login(app);

  const profile = {
    age: 32,
    height: 175,
    weight: 72,
    targetWeight: 68,
    sex: 'male',
    activityLevel: 'moderate',
    goal: 'lose',
    timezone: 'Europe/Moscow',
  };

  const saved = await request(app)
    .post('/api/user/profile')
    .set(authHeader(token))
    .send(profile);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.data.user.onboardingCompleted, true);
  assert.equal(saved.body.data.goals.calories > 1500, true);
  assert.ok(saved.body.data.plan);

  const today = localDate(new Date(), 'Europe/Moscow');
  const yesterday = addDays(today, -1);

  const search = await request(app)
    .get('/api/food/search?q=банан')
    .set(authHeader(token));
  assert.equal(search.status, 200);
  const banana = search.body.data.items.find((item) => item.name === 'Банан');
  assert.ok(banana);

  const added = await request(app)
    .post('/api/diary')
    .set(authHeader(token))
    .set('X-Idempotency-Key', 'banana-add-1')
    .send({ productId: banana.id, amountGrams: 150, mealType: 'breakfast', date: today });
  assert.equal(added.status, 201, JSON.stringify(added.body));
  const entryId = added.body.data.entry.id;
  assert.equal(added.body.data.entry.calories, 133.5);

  // Repeating the same mutation with the same idempotency key must not duplicate.
  const replay = await request(app)
    .post('/api/diary')
    .set(authHeader(token))
    .set('X-Idempotency-Key', 'banana-add-1')
    .send({ productId: banana.id, amountGrams: 150, mealType: 'breakfast', date: today });
  assert.equal(replay.status, 201);
  assert.equal(replay.body.idempotentReplay, true);

  const diary = await request(app).get(`/api/diary/${today}`).set(authHeader(token));
  assert.equal(diary.status, 200);
  assert.equal(diary.body.data.entries.length, 1);
  assert.equal(diary.body.data.totals.calories, 134);
  assert.equal(diary.body.data.meals.find((meal) => meal.type === 'breakfast').entries.length, 1);

  const dashboard = await request(app)
    .get(`/api/dashboard?date=${today}`)
    .set(authHeader(token));
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.data.totals.calories, 134);
  assert.equal(dashboard.body.data.streak.current, 1);
  assert.equal(dashboard.body.data.week.length, 7);

  const updated = await request(app)
    .put(`/api/diary/${entryId}`)
    .set(authHeader(token))
    .send({ amountGrams: 200, mealType: 'lunch' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.entry.amountGrams, 200);
  assert.equal(updated.body.data.entry.calories, 178);
  assert.equal(updated.body.data.entry.mealType, 'lunch');

  const stats = await request(app)
    .get('/api/statistics?period=7d')
    .set(authHeader(token));
  assert.equal(stats.status, 200);
  assert.equal(stats.body.data.hasData, true);
  assert.equal(stats.body.data.regularity.loggedDays, 1);
  assert.equal(stats.body.data.average.calories, 178);

  // Copy yesterday's lunch to today (per-meal copy).
  await request(app)
    .post('/api/diary')
    .set(authHeader(token))
    .send({ productId: banana.id, amountGrams: 50, mealType: 'breakfast', date: yesterday });
  await request(app)
    .post('/api/diary')
    .set(authHeader(token))
    .send({ productId: banana.id, amountGrams: 100, mealType: 'lunch', date: yesterday });
  const copy = await request(app)
    .post('/api/diary/copy')
    .set(authHeader(token))
    .send({ fromDate: yesterday, toDate: today, mealType: 'lunch' });
  assert.equal(copy.status, 201);
  assert.equal(copy.body.data.count, 1);
  assert.equal(copy.body.data.entries[0].mealType, 'lunch');

  const previous = await request(app)
    .get(`/api/diary/previous?date=${today}`)
    .set(authHeader(token));
  assert.equal(previous.status, 200);
  assert.equal(previous.body.data.date, yesterday);
  assert.equal(previous.body.data.count, 2);
  assert.deepEqual(
    previous.body.data.meals.map((meal) => [meal.type, meal.count]).sort(),
    [
      ['breakfast', 1],
      ['lunch', 1],
    ],
  );

  // Weight & progress.
  const weight = await request(app)
    .post('/api/weight')
    .set(authHeader(token))
    .send({ weight: 71.6, date: today });
  assert.equal(weight.status, 201);
  assert.equal(weight.body.data.weight, 71.6);

  const progress = await request(app)
    .get('/api/progress?period=30d')
    .set(authHeader(token));
  assert.equal(progress.status, 200);
  assert.equal(progress.body.data.currentWeight, 71.6);
  assert.equal(progress.body.data.targetWeight, 68);
  assert.equal(progress.body.data.toTarget, 3.6);

  const measurement = await request(app)
    .post('/api/measurements')
    .set(authHeader(token))
    .send({ waist: 82, hips: 96, date: today });
  assert.equal(measurement.status, 201);

  // Water.
  const water = await request(app)
    .post('/api/water')
    .set(authHeader(token))
    .send({ amountMl: 250, date: today });
  assert.equal(water.status, 200);
  assert.equal(water.body.data.amountMl, 250);

  // Reminders.
  const reminders = await request(app)
    .get('/api/reminders')
    .set(authHeader(token));
  assert.equal(reminders.status, 200);
  assert.equal(reminders.body.data.breakfastTime, '10:00');

  const reminderUpdate = await request(app)
    .put('/api/reminders')
    .set(authHeader(token))
    .send({ breakfastTime: '08:15', remindersEnabled: false, waterEnabled: true });
  assert.equal(reminderUpdate.status, 200);
  assert.equal(reminderUpdate.body.data.breakfastTime, '08:15');
  assert.equal(reminderUpdate.body.data.remindersEnabled, false);
  assert.equal(reminderUpdate.body.data.waterEnabled, true);

  // Delete an entry.
  const removed = await request(app)
    .delete(`/api/diary/${entryId}`)
    .set(authHeader(token));
  assert.equal(removed.status, 200);
  const diaryAfter = await request(app).get(`/api/diary/${today}`).set(authHeader(token));
  assert.equal(diaryAfter.body.data.entries.length, 1);

  // Health is public.
  const health = await request(app).get('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.data.status, 'healthy');
  assert.equal(health.body.data.welcomePhoto, true);
  assert.ok(health.body.data.welcomePhotoBytes > 1000);

  assert.ok(user.id);
  assert.ok(repository.users.size > 0);
});

test('validation and ownership boundaries', async () => {
  const { app } = await setupApp();
  const first = await login(app, '900000010');
  const second = await login(app, '900000011');

  const invalid = await request(app)
    .post('/api/user/profile')
    .set(authHeader(first.token))
    .send({ age: 12, height: 170, weight: 60, sex: 'male', activityLevel: 'moderate', goal: 'lose', timezone: 'Europe/Moscow' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');

  const badTimezone = await request(app)
    .post('/api/user/profile')
    .set(authHeader(first.token))
    .send({
      age: 30, height: 170, weight: 60, sex: 'male',
      activityLevel: 'moderate', goal: 'lose', timezone: 'Nowhere/City',
    });
  assert.equal(badTimezone.status, 400);

  const today = localDate(new Date(), 'UTC');
  const search = await request(app)
    .get('/api/food/search?q=банан')
    .set(authHeader(first.token));
  const banana = search.body.data.items[0];
  const entry = await request(app)
    .post('/api/diary')
    .set(authHeader(first.token))
    .send({ productId: banana.id, amountGrams: 100, mealType: 'snack', date: today });
  assert.equal(entry.status, 201);

  const stolen = await request(app)
    .put(`/api/diary/${entry.body.data.entry.id}`)
    .set(authHeader(second.token))
    .send({ amountGrams: 50 });
  assert.equal(stolen.status, 404);

  const unknown = await request(app)
    .post('/api/diary')
    .set(authHeader(first.token))
    .send({ productId: banana.id, amountGrams: -5, mealType: 'snack' });
  assert.equal(unknown.status, 400);

  const noAuth = await request(app).get('/api/diary/' + today);
  assert.equal(noAuth.status, 401);

  const missing = await request(app)
    .get('/api/diary/2026-01-01')
    .set(authHeader(first.token));
  assert.equal(missing.status, 200);
  assert.equal(missing.body.data.entries.length, 0);
});

test('profile update recalculates goals and respects under-18 safety', async () => {
  const { app } = await setupApp();
  const { token } = await login(app, '900000020');

  const response = await request(app)
    .post('/api/user/profile')
    .set(authHeader(token))
    .send({
      age: 16,
      height: 170,
      weight: 62,
      sex: 'female',
      activityLevel: 'light',
      goal: 'lose',
      timezone: 'Asia/Tokyo',
    });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.plan.goal, 'maintain');
  assert.equal(response.body.data.plan.isMinor, true);
  assert.ok(response.body.data.goals.calories >= 1600);
  assert.ok(response.body.data.plan.warnings.length > 0);
  assert.equal(response.body.data.user.timezone, 'Asia/Tokyo');
});
