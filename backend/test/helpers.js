import crypto from 'node:crypto';
import { createConfig } from '../src/config/index.js';
import { MemoryRepository } from '../src/database/memory.repository.js';
import { createApp } from '../src/app.js';

export function buildTestConfig(overrides = {}) {
  return createConfig({
    NODE_ENV: 'test',
    ENABLE_DEV_AUTH: 'true',
    JWT_SECRET: 'test-secret-that-is-long-enough-for-hmac-signing-12345',
    MINI_APP_URL: 'http://localhost:5500/',
    CORS_ORIGINS: 'http://localhost:5500',
    SCHEDULER_ENABLED: 'false',
    ...overrides,
  });
}

export async function setupApp(configOverrides = {}) {
  const config = buildTestConfig(configOverrides);
  const repository = new MemoryRepository();
  const app = createApp({ repository, config });
  return { config, repository, app };
}

export function signTelegramInitData(botToken, user, authDate = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: 'AAHdF6IQAAAAAN0Xoha',
    user: JSON.stringify(user),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}
