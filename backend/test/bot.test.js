import test from 'node:test';
import assert from 'node:assert/strict';
import { createBot } from '../src/bot.js';
import { MemoryRepository } from '../src/database/memory.repository.js';
import { buildTestConfig } from './helpers.js';

const BOT_INFO = {
  id: 123456,
  is_bot: true,
  first_name: 'CALORIA',
  username: 'caloria_test_bot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
};

/**
 * Builds a bot whose Telegram API is stubbed. Telegraf creates a new Telegram
 * client for every update context, so the stub is installed on the prototype.
 */
async function setupBot() {
  const config = buildTestConfig({
    BOT_TOKEN: '123456:test-token',
    MINI_APP_URL: 'https://example.github.io/caloria/',
  });
  const repository = new MemoryRepository();
  await repository.init();
  const bot = createBot({ config, repository });
  bot.botInfo = { ...BOT_INFO };

  const calls = [];
  const prototype = Object.getPrototypeOf(bot.telegram);
  const originalCallApi = prototype.callApi;
  prototype.callApi = async function callApi(method, payload = {}) {
    calls.push({ method, payload });
    if (method === 'getMe') return bot.botInfo;
    if (method === 'sendMessage' || method === 'editMessageText') {
      return {
        message_id: calls.length,
        date: Math.floor(Date.now() / 1000),
        chat: { id: payload.chat_id, type: 'private' },
        text: payload.text,
      };
    }
    return true;
  };

  return {
    bot,
    repository,
    calls,
    restore: () => {
      prototype.callApi = originalCallApi;
    },
  };
}

const from = { id: 555000111, is_bot: false, first_name: 'Кирилл', username: 'kirill', language_code: 'ru' };
const chat = { id: from.id, type: 'private', first_name: 'Кирилл', username: 'kirill' };
const now = Math.floor(Date.now() / 1000);

test('bot /start creates a user and returns the Mini App button', async (t) => {
  const { bot, repository, calls, restore } = await setupBot();
  t.after(restore);

  await bot.handleUpdate({
    update_id: 1,
    message: {
      message_id: 1,
      from,
      chat,
      date: now,
      text: '/start',
      entities: [{ type: 'bot_command', offset: 0, length: 6 }],
    },
  });

  const reply = calls.at(-1);
  assert.equal(reply.method, 'sendMessage');
  assert.match(reply.payload.text, /Добро пожаловать/);
  assert.match(JSON.stringify(reply.payload.reply_markup), /web_app/);
  assert.match(JSON.stringify(reply.payload.reply_markup), /example\.github\.io/);

  const user = await repository.getUserByTelegramId(String(from.id));
  assert.ok(user, 'user should be created on /start');
  assert.equal(user.firstName, 'Кирилл');
});

test('bot food message requires confirmation before saving', async (t) => {
  const { bot, repository, calls, restore } = await setupBot();
  t.after(restore);

  await bot.handleUpdate({
    update_id: 2,
    message: { message_id: 2, from, chat, date: now, text: 'Съела 2 яйца и 100 грамм хлеба' },
  });

  const confirmation = calls.find((call) => call.method === 'sendMessage');
  assert.ok(confirmation, 'confirmation message expected');
  assert.match(confirmation.payload.text, /Распознано/);
  assert.match(confirmation.payload.text, /Яйцо куриное/);
  assert.match(confirmation.payload.text, /Хлеб/);

  const user = await repository.getUserByTelegramId(String(from.id));
  const today = new Date().toISOString().slice(0, 10);
  const before = await repository.listEntries(user.id, `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`);
  assert.equal(before.length, 0, 'nothing may be saved before confirmation');

  const buttons = confirmation.payload.reply_markup.inline_keyboard.flat();
  const confirmButton = buttons.find((button) => String(button.callback_data).startsWith('confirm:'));
  const cancelButton = buttons.find((button) => String(button.callback_data).startsWith('cancel:'));
  assert.ok(confirmButton, 'confirm button expected');
  assert.ok(cancelButton, 'cancel button expected');

  await bot.handleUpdate({
    update_id: 3,
    callback_query: {
      id: 'cb-1',
      from,
      chat_instance: 'test',
      data: confirmButton.callback_data,
      message: {
        message_id: 2,
        from: { id: BOT_INFO.id, is_bot: true, first_name: 'CALORIA', username: BOT_INFO.username },
        chat,
        date: now,
        text: 'x',
      },
    },
  });

  const after = await repository.listEntries(user.id, `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`);
  assert.equal(after.length, 2);
  const allowedMeals = ['breakfast', 'lunch', 'dinner', 'snack'];
  assert.ok(after.every((entry) => allowedMeals.includes(entry.mealType)));
  assert.ok(after.every((entry) => entry.calories > 0));

  const edited = calls.filter((call) => call.method === 'editMessageText').at(-1);
  assert.match(edited.payload.text, /Добавлено в дневник/);
});

test('bot cancel leaves the diary untouched', async (t) => {
  const { bot, repository, calls, restore } = await setupBot();
  t.after(restore);

  await bot.handleUpdate({
    update_id: 4,
    message: { message_id: 3, from, chat, date: now, text: 'банан 150 г' },
  });
  const confirmation = calls.find((call) => call.method === 'sendMessage');
  const cancelButton = confirmation.payload.reply_markup.inline_keyboard
    .flat()
    .find((button) => String(button.callback_data).startsWith('cancel:'));

  await bot.handleUpdate({
    update_id: 5,
    callback_query: {
      id: 'cb-2',
      from,
      chat_instance: 'test',
      data: cancelButton.callback_data,
      message: {
        message_id: 3,
        from: { id: BOT_INFO.id, is_bot: true, first_name: 'CALORIA', username: BOT_INFO.username },
        chat,
        date: now,
        text: 'x',
      },
    },
  });

  const user = await repository.getUserByTelegramId(String(from.id));
  const today = new Date().toISOString().slice(0, 10);
  const entries = await repository.listEntries(user.id, `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`);
  assert.equal(entries.length, 0);

  const edited = calls.filter((call) => call.method === 'editMessageText').at(-1);
  assert.match(edited.payload.text, /Ничего не сохранено/);
});