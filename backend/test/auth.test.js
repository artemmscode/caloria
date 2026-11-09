import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupApp, signTelegramInitData } from './helpers.js';
import { verifyTelegramInitData } from '../src/services/auth.service.js';

const BOT_TOKEN = '123456789:AAHtest-token-for-automated-tests-only';

test('Telegram initData signature verification', async (t) => {
  await t.test('accepts valid data and returns trusted identity', () => {
    const initData = signTelegramInitData(BOT_TOKEN, {
      id: 777001,
      first_name: 'Анна',
      username: 'anna',
    });
    const result = verifyTelegramInitData(initData, BOT_TOKEN, 86400);
    assert.equal(result.telegramId, '777001');
    assert.equal(result.firstName, 'Анна');
    assert.equal(result.username, 'anna');
  });

  await t.test('rejects tampered payload', () => {
    const initData = signTelegramInitData(BOT_TOKEN, { id: 777001, first_name: 'Анна' });
    const tampered = initData.replace('777001', '777002');
    assert.throws(() => verifyTelegramInitData(tampered, BOT_TOKEN, 86400), /подпись/i);
  });

  await t.test('rejects another bot token', () => {
    const initData = signTelegramInitData(BOT_TOKEN, { id: 777001 });
    assert.throws(
      () => verifyTelegramInitData(initData, '987654321:AAHdifferent-token', 86400),
      /подпись/i,
    );
  });

  await t.test('rejects expired auth_date', () => {
    const initData = signTelegramInitData(
      BOT_TOKEN,
      { id: 777001 },
      Math.floor(Date.now() / 1000) - 90000,
    );
    assert.throws(() => verifyTelegramInitData(initData, BOT_TOKEN, 86400), /устарела/i);
  });
});

test('POST /api/auth/telegram creates a user and issues a session', async () => {
  const { app } = await setupApp({ BOT_TOKEN, ENABLE_DEV_AUTH: 'false' });
  const initData = signTelegramInitData(BOT_TOKEN, {
    id: 555444333,
    first_name: 'Иван',
    username: 'ivan_test',
    language_code: 'ru',
  });

  const response = await request(app)
    .post('/api/auth/telegram')
    .set('Content-Type', 'application/json')
    .send({ initData });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.ok(response.body.data.token);
  assert.equal(response.body.data.user.telegramId, '555444333');
  assert.equal(response.body.data.user.onboardingCompleted, false);
  assert.equal(response.body.data.user.username, 'ivan_test');

  const profile = await request(app)
    .get('/api/user/profile')
    .set('Authorization', `Bearer ${response.body.data.token}`);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.data.user.id, response.body.data.user.id);
});

test('POST /api/auth/telegram rejects unsigned requests', async () => {
  const { app } = await setupApp({ BOT_TOKEN, ENABLE_DEV_AUTH: 'false' });
  const response = await request(app)
    .post('/api/auth/telegram')
    .send({ initData: 'auth_date=1&user=%7B%22id%22%3A1%7D&hash=deadbeef' });
  assert.equal(response.status, 401);
  assert.equal(response.body.ok, false);
});

test('protected endpoints require a session', async () => {
  const { app } = await setupApp();
  const response = await request(app).get('/api/user/profile');
  assert.equal(response.status, 401);
});
