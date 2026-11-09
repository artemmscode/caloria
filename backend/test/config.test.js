import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfig } from '../src/config/index.js';

const base = {
  NODE_ENV: 'production',
  BOT_TOKEN: '123456:test-token',
  WEBHOOK_SECRET: 'webhook-secret',
  MINI_APP_URL: 'https://user.github.io/caloria/',
  JWT_SECRET: 'j'.repeat(48),
  SUPABASE_URL: 'https://project.supabase.co',
  RENDER_EXTERNAL_URL: 'https://caloria-api.onrender.com',
};

test('production config accepts a new sb_secret_ Supabase key', () => {
  const config = createConfig({ ...base, SUPABASE_SECRET_KEY: 'sb_secret_example' });
  assert.equal(config.supabaseServiceRoleKey, 'sb_secret_example');
  assert.equal(config.hasSupabase, true);
  assert.equal(config.webhookUrl, 'https://caloria-api.onrender.com');
});

test('production config still accepts a legacy service_role key', () => {
  const config = createConfig({ ...base, SUPABASE_SERVICE_ROLE_KEY: 'legacy.jwt.key' });
  assert.equal(config.supabaseServiceRoleKey, 'legacy.jwt.key');
  assert.equal(config.hasSupabase, true);
});

test('production config requires a Supabase secret key', () => {
  assert.throws(() => createConfig({ ...base }), /SUPABASE_SECRET_KEY/);
});

test('production config requires a webhook URL or RENDER_EXTERNAL_URL', () => {
  const { RENDER_EXTERNAL_URL, ...withoutRender } = base;
  assert.throws(
    () => createConfig({ ...withoutRender, SUPABASE_SECRET_KEY: 'sb_secret_example' }),
    /WEBHOOK_URL/,
  );
});