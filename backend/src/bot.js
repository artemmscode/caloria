import { Telegraf, Markup } from 'telegraf';
import { logger } from './utils/logger.js';
import { calculatePlan } from './services/nutrition.js';
import { buildDiary, fallbackGoals, getGoalsOrDefault, mealForLocalTime } from './services/diary.service.js';
import { getReminders, updateReminders } from './services/reminder.service.js';
import { parseFoodMessage, describeParse } from './services/foodParser.js';
import { recognizeFoodPhoto } from './services/vision.service.js';
import { humanDate, isValidTimeString, localDate, localTime, safeTimezone } from './utils/time.js';
import { getDashboard } from './services/stats.service.js';

const escapeHtml = (value = '') =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const openAppButton = (config) =>
  Markup.inlineKeyboard([[Markup.button.webApp('ОТКРЫТЬ CALORIA', config.miniAppUrl)]]);

const timeEditing = new Map();

export async function ensureBotUser(repository, from, config) {
  let user = await repository.getUserByTelegramId(String(from.id));
  if (!user) {
    user = await repository.createUser({
      telegramId: String(from.id),
      username: from.username || null,
      firstName: from.first_name || null,
      lastName: from.last_name || null,
      timezone: config.defaultTimezone,
    });
  }
  return user;
}

function welcomeText(user, config) {
  const name = user.firstName ? `, ${escapeHtml(user.firstName)}` : '';
  return (
    `✨ <b>Добро пожаловать в CALORIA${name}!</b>\n\n` +
    'Это спокойный дневник питания: калории, БЖУ, вода, вес и динамика — без давления и оценок.\n\n' +
    '<b>Что умеет бот</b>\n' +
    '• Добавлять еду текстом: «2 яйца и 100 г хлеба»\n' +
    '• Присылать мягкие напоминания\n' +
    '• Показывать сводку за день\n\n' +
    'Откройте приложение, чтобы заполнить профиль и настроить цели.\n\n' +
    '<i>Расчёты носят ориентировочный характер и не заменяют консультацию специалиста.</i>'
  );
}

async function showToday(ctx, repository, user, config) {
  const date = localDate(new Date(), user.timezone);
  const diary = await buildDiary(repository, user, date);
  const goals = diary.goals || fallbackGoals();
  const remaining = Math.round(goals.calories - diary.totals.calories);
  const remainingText =
    remaining >= 0 ? `Осталось: <b>${remaining} ккал</b>` : `Выше цели на <b>${Math.abs(remaining)} ккал</b>`;
  await ctx.reply(
    `📅 <b>${humanDate(date, user.timezone)}</b>\n\n` +
      `🔥 Съедено: <b>${diary.totals.calories} ккал</b> из ${goals.calories}\n` +
      `${remainingText}\n\n` +
      `🥩 Белки: ${diary.totals.protein} / ${goals.protein} г\n` +
      `🥑 Жиры: ${diary.totals.fat} / ${goals.fat} г\n` +
      `🍞 Углеводы: ${diary.totals.carbohydrates} / ${goals.carbohydrates} г\n\n` +
      `🍽️ Записей: ${diary.entries.length}\n` +
      (diary.entries.length
        ? describeParse(
            diary.entries.slice(0, 5).map((entry) => ({
              name: entry.productNameSnapshot,
              amountGrams: entry.amountGrams,
              emoji: '•',
            })),
          )
        : 'Дневник пока пуст — это нормально. Начните с любого приёма пищи.'),
    { parse_mode: 'HTML', ...openAppButton(config) },
  );
}

function settingsKeyboard(settings, config) {
  const state = (enabled) => (enabled ? 'вкл' : 'выкл');
  return Markup.inlineKeyboard([
    [Markup.button.callback(`Уведомления: ${state(settings.remindersEnabled)}`, 'toggle:reminders')],
    [Markup.button.callback(`☀️ Утро · ${settings.morningTime}`, 'settime:morning')],
    [Markup.button.callback(`🍳 Завтрак · ${settings.breakfastTime}`, 'settime:breakfast')],
    [Markup.button.callback(`🥗 Обед · ${settings.lunchTime}`, 'settime:lunch')],
    [Markup.button.callback(`🍽️ Ужин · ${settings.dinnerTime}`, 'settime:dinner')],
    [Markup.button.callback(`🌙 Вечер · ${settings.eveningTime}`, 'settime:evening')],
    [Markup.button.callback(`💧 Вода: ${state(settings.waterEnabled)}`, 'toggle:water')],
    [Markup.button.webApp('ОТКРЫТЬ НАСТРОЙКИ В ПРИЛОЖЕНИИ', `${config.miniAppUrl}#profile`)],
  ]);
}

async function showSettings(ctx, repository, user, config, edit = false) {
  const settings = await getReminders(repository, user);
  const text =
    '⚙️ <b>Напоминания CALORIA</b>\n\n' +
    `Часовой пояс: <b>${escapeHtml(settings.timezone)}</b>\n` +
    `Тихие часы: ${settings.quietStart}–${settings.quietEnd}\n\n` +
    'Нажмите на тип напоминания, чтобы изменить время. ' +
    'Уведомления не отправляются в тихие часы и дублируются только один раз.';
  const options = { parse_mode: 'HTML', ...settingsKeyboard(settings, config) };
  if (edit) await ctx.editMessageText(text, options);
  else await ctx.reply(text, options);
}

export function createBot({ config, repository }) {
  if (!config.botToken) {
    logger.warn('BOT_TOKEN is not set — Telegram bot is disabled');
    return null;
  }

  const bot = new Telegraf(config.botToken, { handlerTimeout: 50000 });

  bot.catch((error, ctx) => {
    logger.error('Bot handler error', {
      updateType: ctx.updateType,
      reason: error.message,
    });
    ctx.reply('Что-то пошло не так. Попробуйте ещё раз через минуту.').catch(() => {});
  });

  bot.start(async (ctx) => {
    try {
      const user = await ensureBotUser(repository, ctx.from, config);
      await ctx.reply(welcomeText(user, config), {
        parse_mode: 'HTML',
        ...openAppButton(config),
      });
    } catch (error) {
      logger.error('Bot /start failed', { reason: error.message });
      await ctx.reply('Не удалось открыть профиль. Попробуйте позже.');
    }
  });

  bot.command('app', async (ctx) => {
    await ctx.reply('Откройте CALORIA — дневник и цели уже внутри.', openAppButton(config));
  });

  bot.command('today', async (ctx) => {
    const user = await ensureBotUser(repository, ctx.from, config);
    await showToday(ctx, repository, user, config);
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      '📖 <b>Команды CALORIA</b>\n\n' +
        '/start — приветствие и запуск\n' +
        '/app — открыть Mini App\n' +
        '/today — сводка за сегодня\n' +
        '/settings — напоминания\n' +
        '/reminders — то же, что /settings\n' +
        '/time завтрак 08:30 — изменить время\n' +
        '/help — эта справка\n\n' +
        'Можно просто написать, что вы съели: «омлет и 100 г хлеба». ' +
        'Бот покажет расчёт и попросит подтверждение — без подтверждения ничего не сохраняется.',
      { parse_mode: 'HTML' },
    );
  });

  const remindersHandler = async (ctx) => {
    const user = await ensureBotUser(repository, ctx.from, config);
    await showSettings(ctx, repository, user, config);
  };
  bot.command('settings', remindersHandler);
  bot.command('reminders', remindersHandler);

  bot.command('time', async (ctx) => {
    const [, type, value] = (ctx.message.text || '').split(/\s+/);
    if (!type || !value || !isValidTimeString(value)) {
      await ctx.reply('Формат: /time завтрак 08:30\nДоступно: утро, завтрак, обед, ужин, вечер.');
      return;
    }
    await applyTime(ctx, repository, config, type, value);
  });

  bot.action(/^toggle:(reminders|water|morning|breakfast|lunch|dinner|evening)$/, async (ctx) => {
    const user = await ensureBotUser(repository, ctx.from, config);
    const settings = await getReminders(repository, user);
    const key = ctx.match[1];
    const mapping = {
      reminders: 'remindersEnabled',
      water: 'waterEnabled',
      morning: 'morningEnabled',
      breakfast: 'breakfastEnabled',
      lunch: 'lunchEnabled',
      dinner: 'dinnerEnabled',
      evening: 'eveningEnabled',
    };
    await updateReminders(repository, user, { [mapping[key]]: !settings[mapping[key]] });
    await ctx.answerCbQuery('Сохранено');
    await showSettings(ctx, repository, user, config, true);
  });

  bot.action(/^settime:(morning|breakfast|lunch|dinner|evening)$/, async (ctx) => {
    const user = await ensureBotUser(repository, ctx.from, config);
    const type = ctx.match[1];
    timeEditing.set(String(ctx.from.id), { type, expires: Date.now() + 5 * 60 * 1000 });
    await ctx.answerCbQuery();
    await ctx.reply(
      `Отправьте время для «${type}» в формате <b>ЧЧ:ММ</b>, например <code>08:30</code>.\n` +
        'Изменение действует 5 минут. /cancel — отмена.',
      { parse_mode: 'HTML' },
    );
  });

  bot.command('cancel', async (ctx) => {
    timeEditing.delete(String(ctx.from.id));
    await ctx.reply('Отменено.');
  });

  async function applyTime(ctx, repository, config, type, value) {
    const mapping = {
      утро: 'morningTime',
      morning: 'morningTime',
      завтрак: 'breakfastTime',
      breakfast: 'breakfastTime',
      обед: 'lunchTime',
      lunch: 'lunchTime',
      ужин: 'dinnerTime',
      dinner: 'dinnerTime',
      вечер: 'eveningTime',
      evening: 'eveningTime',
    };
    const field = mapping[type.toLowerCase()];
    if (!field) {
      await ctx.reply('Неизвестный тип. Используйте: утро, завтрак, обед, ужин, вечер.');
      return;
    }
    const user = await ensureBotUser(repository, ctx.from, config);
    await updateReminders(repository, user, { [field]: value });
    timeEditing.delete(String(ctx.from.id));
    await ctx.reply(`✅ Время обновлено: <b>${value}</b>`, { parse_mode: 'HTML' });
  }

  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text || '';
    if (text.startsWith('/')) return next();

    const telegramId = String(ctx.from.id);
    const editing = timeEditing.get(telegramId);
    if (editing && editing.expires > Date.now()) {
      if (!isValidTimeString(text.trim())) {
        await ctx.reply('Нужен формат ЧЧ:ММ, например 08:30.');
        return;
      }
      await applyTime(ctx, repository, config, editing.type, text.trim());
      return;
    }

    try {
      const user = await ensureBotUser(repository, ctx.from, config);
      const foods = await repository.listAllFoods(user.id);
      const parsed = parseFoodMessage(text, foods);
      if (!parsed.items.length) {
        await ctx.reply(
          'Не удалось найти продукты в сообщении. Попробуйте так:\n' +
            '«2 яйца и 100 г хлеба»\n' +
            '«банан 150 г»\n\n' +
            'Можно добавить свой продукт в приложении.',
        );
        return;
      }
      await sendConfirmation(ctx, repository, config, user, parsed, 'text');
    } catch (error) {
      logger.error('Bot text parse failed', { reason: error.message });
      await ctx.reply('Не удалось обработать сообщение. Попробуйте ещё раз.');
    }
  });

  bot.on('photo', async (ctx) => {
    try {
      const user = await ensureBotUser(repository, ctx.from, config);
      const foods = await repository.listAllFoods(user.id);
      const caption = ctx.message.caption || '';
      let parsed = caption ? parseFoodMessage(caption, foods) : { items: [], totals: null };
      let note = null;

      if (!parsed.items.length) {
        if (!config.openaiApiKey) {
          await ctx.reply(
            '📷 Распознавание фото пока не подключено.\n\n' +
              'Опишите еду текстом — например: «омлет, тост и 100 г творога». Это займёт несколько секунд.',
          );
          return;
        }
        const photos = ctx.message.photo;
        const largest = photos[photos.length - 1];
        const link = await ctx.telegram.getFileLink(largest.file_id);
        const vision = await recognizeFoodPhoto({
          bot,
          photoUrl: link.href,
          foods,
          userId: user.id,
          repository,
          config,
        });
        if (!vision.items.length) {
          await ctx.reply(
            `📷 ${escapeHtml(vision.note || 'Не удалось распознать блюда.')}\n\n` +
              'Попробуйте описать еду текстом.',
          );
          return;
        }
        parsed = {
          items: vision.items,
          totals: vision.items.reduce(
            (acc, item) => ({
              calories: Math.round(acc.calories + item.calories),
              protein: Math.round((acc.protein + item.protein) * 10) / 10,
              fat: Math.round((acc.fat + item.fat) * 10) / 10,
              carbohydrates: Math.round((acc.carbohydrates + item.carbohydrates) * 10) / 10,
            }),
            { calories: 0, protein: 0, fat: 0, carbohydrates: 0 },
          ),
          approximate: true,
        };
        note = vision.note;
      }
      await sendConfirmation(ctx, repository, config, user, parsed, 'photo', note);
    } catch (error) {
      logger.error('Bot photo failed', { reason: error.message });
      await ctx.reply('Не удалось обработать фото. Опишите еду текстом.');
    }
  });

  bot.action(/^confirm:([A-Za-z0-9_-]{10,80})$/, async (ctx) => {
    const pendingId = ctx.match[1];
    try {
      const user = await ensureBotUser(repository, ctx.from, config);
      const pending = await repository.getPendingEntry(pendingId);
      if (!pending || pending.userId !== user.id) {
        await ctx.answerCbQuery('Запись уже обработана или устарела');
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
        return;
      }
      await repository.deletePendingEntry(pendingId);
      const mealType =
        pending.payload.mealType ||
        mealForLocalTime(localTime(new Date(), user.timezone));
      const created = await repository.createEntries(
        pending.payload.items.map((item) => ({
          userId: user.id,
          productId: item.productId,
          productNameSnapshot: item.name,
          mealType,
          amountGrams: item.amountGrams,
          calories: item.calories,
          protein: item.protein,
          fat: item.fat,
          carbohydrates: item.carbohydrates,
          consumedAt: new Date().toISOString(),
          entryDate: localDate(new Date(), user.timezone),
        })),
      );
      await repository.incrementFoodUsage(created.map((entry) => entry.productId).filter(Boolean));
      await ctx.answerCbQuery('Добавлено');
      await ctx.editMessageText(
        `✅ <b>Добавлено в дневник</b>\n\n${describeParse(pending.payload.items)}\n\n` +
          `Итого: <b>${pending.payload.totals.calories} ккал</b> · Б ${pending.payload.totals.protein} · Ж ${pending.payload.totals.fat} · У ${pending.payload.totals.carbohydrates}`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('Сводка за день', 'today')],
            [Markup.button.webApp('ОТКРЫТЬ CALORIA', config.miniAppUrl)],
          ]),
        },
      );
    } catch (error) {
      logger.error('Bot confirmation failed', { reason: error.message });
      await ctx.answerCbQuery('Ошибка сохранения', { show_alert: true });
    }
  });

  bot.action(/^cancel:([A-Za-z0-9_-]{10,80})$/, async (ctx) => {
    const pendingId = ctx.match[1];
    await repository.deletePendingEntry(pendingId).catch(() => {});
    await ctx.answerCbQuery('Отменено');
    await ctx.editMessageText('Отменено. Ничего не сохранено.', Markup.inlineKeyboard([]));
  });

  bot.action('today', async (ctx) => {
    const user = await ensureBotUser(repository, ctx.from, config);
    const date = localDate(new Date(), user.timezone);
    const diary = await buildDiary(repository, user, date);
    const goals = diary.goals || fallbackGoals();
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `🔥 <b>${diary.totals.calories} / ${goals.calories} ккал</b>\n` +
        `Б ${diary.totals.protein} · Ж ${diary.totals.fat} · У ${diary.totals.carbohydrates}\n` +
        `Записей: ${diary.entries.length}`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.webApp('ОТКРЫТЬ CALORIA', config.miniAppUrl)]]),
      },
    );
  });

  return bot;
}

async function sendConfirmation(ctx, repository, config, user, parsed, source, note) {
  const mealType = mealForLocalTime(localTime(new Date(), user.timezone));
  const pending = await repository.createPendingEntry({
    userId: user.id,
    payload: {
      items: parsed.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        amountGrams: item.amountGrams,
        calories: item.calories,
        protein: item.protein,
        fat: item.fat,
        carbohydrates: item.carbohydrates,
      })),
      totals: parsed.totals,
      mealType,
      source,
    },
    expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
  });

  const warning =
    parsed.approximate || source === 'photo'
      ? '\n\n<i>Порции и значения — приблизительная оценка. Проверьте перед сохранением.</i>'
      : '';
  const noteText = note ? `\n<i>${escapeHtml(note)}</i>` : '';
  await ctx.reply(
    `🍽️ <b>Распознано</b>\n\n${describeParse(parsed.items)}\n\n` +
      `Итого: <b>${parsed.totals.calories} ккал</b>\n` +
      `Белки ${parsed.totals.protein} · Жиры ${parsed.totals.fat} · Углеводы ${parsed.totals.carbohydrates}` +
      noteText +
      warning +
      '\n\n<b>Сохранить в дневник?</b>',
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Добавить', `confirm:${pending.id}`),
          Markup.button.callback('Отменить', `cancel:${pending.id}`),
        ],
        [Markup.button.webApp('ОТКРЫТЬ CALORIA', config.miniAppUrl)],
      ]),
    },
  );
}

export async function configureBotProfile(bot, config) {
  if (!bot) return;
  try {
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Запустить CALORIA' },
      { command: 'today', description: 'Сводка за сегодня' },
      { command: 'app', description: 'Открыть Mini App' },
      { command: 'settings', description: 'Напоминания' },
      { command: 'reminders', description: 'Управление напоминаниями' },
      { command: 'help', description: 'Помощь' },
    ]);
    if (/^https:\/\//.test(config.miniAppUrl)) {
      await bot.telegram.setChatMenuButton({
        menuButton: { type: 'web_app', text: 'CALORIA', web_app: { url: config.miniAppUrl } },
      });
      await bot.telegram.setMyDescription({
        description:
          'CALORIA — спокойный дневник питания. Калории, БЖУ, вода, вес и мягкие напоминания.',
      });
    }
    logger.info('Bot commands and menu button configured');
  } catch (error) {
    logger.warn('Could not configure bot profile', { reason: error.message });
  }
}
