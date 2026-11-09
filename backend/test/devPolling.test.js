import test from 'node:test';
import assert from 'node:assert/strict';
import { startDevPolling } from '../src/utils/devPolling.js';

function fakeBot({ webhookUrl = '', failInfo = false } = {}) {
  const launches = [];
  return {
    launches,
    telegram: {
      async getWebhookInfo() {
        if (failInfo) throw new Error('network down');
        return { url: webhookUrl };
      },
    },
    launch(options) {
      launches.push(options);
      return Promise.resolve();
    },
  };
}

function fakeLogger() {
  const entries = [];
  return {
    entries,
    info: (message, meta) => entries.push({ level: 'info', message, meta }),
    warn: (message, meta) => entries.push({ level: 'warn', message, meta }),
    error: (message, meta) => entries.push({ level: 'error', message, meta }),
  };
}

test('starts polling when the bot has no webhook', async () => {
  const bot = fakeBot();
  const logger = fakeLogger();
  const started = await startDevPolling(bot, logger);
  assert.equal(started, true);
  assert.equal(bot.launches.length, 1);
  assert.equal(logger.entries.at(-1).message, 'Telegram bot starting in polling mode (development)');
});

test('skips polling and keeps a production webhook intact', async () => {
  const bot = fakeBot({ webhookUrl: 'https://caloria-api.onrender.com/telegram/webhook' });
  const logger = fakeLogger();
  const started = await startDevPolling(bot, logger);
  assert.equal(started, false);
  assert.equal(bot.launches.length, 0);
  assert.match(logger.entries.at(-1).message, /production webhook is already registered/);
});

test('starts polling when the existing webhook is local', async () => {
  const bot = fakeBot({ webhookUrl: 'http://localhost:3000/telegram/webhook' });
  const logger = fakeLogger();
  const started = await startDevPolling(bot, logger);
  assert.equal(started, true);
  assert.equal(bot.launches.length, 1);
});

test('skips polling when the webhook state cannot be read', async () => {
  const bot = fakeBot({ failInfo: true });
  const logger = fakeLogger();
  const started = await startDevPolling(bot, logger);
  assert.equal(started, false);
  assert.equal(bot.launches.length, 0);
  assert.match(logger.entries.at(-1).message, /dev polling disabled/);
});