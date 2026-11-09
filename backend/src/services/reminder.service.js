import { logger } from '../utils/logger.js';
import { addDays, dayRangeUtc, isQuietHours, localDate, localParts, localTime, minutesFromTime } from '../utils/time.js';
import { defaultReminderSettings } from '../database/memory.repository.js';
import { getEntriesForDate } from './diary.service.js';

export const REMINDER_TYPES = [
  'morning',
  'breakfast',
  'lunch',
  'dinner',
  'evening',
  'water',
];

const REMINDER_META = {
  morning: { enabledKey: 'morningEnabled', timeKey: 'morningTime', label: 'Утреннее приветствие' },
  breakfast: { enabledKey: 'breakfastEnabled', timeKey: 'breakfastTime', label: 'Напоминание о завтраке', meal: 'breakfast' },
  lunch: { enabledKey: 'lunchEnabled', timeKey: 'lunchTime', label: 'Напоминание об обеде', meal: 'lunch' },
  dinner: { enabledKey: 'dinnerEnabled', timeKey: 'dinnerTime', label: 'Напоминание об ужине', meal: 'dinner' },
  evening: { enabledKey: 'eveningEnabled', timeKey: 'eveningTime', label: 'Вечерняя проверка дневника' },
  water: { enabledKey: 'waterEnabled', label: 'Напоминания о воде' },
};

export async function getReminders(repository, user) {
  const settings = (await repository.getReminderSettings(user.id)) ||
    defaultReminderSettings(user.id, user.timezone);
  return {
    ...settings,
    timezone: settings.timezone || user.timezone,
    schedule: REMINDER_META,
    quietHours: { start: settings.quietStart, end: settings.quietEnd },
  };
}

export async function updateReminders(repository, user, patch) {
  const current = await getReminders(repository, user);
  const merged = { ...current, ...patch };
  if (merged.quietStart === merged.quietEnd) {
    merged.quietEnd = merged.quietStart === '08:00' ? '09:00' : '08:00';
  }
  const saved = await repository.upsertReminderSettings(user.id, {
    remindersEnabled: merged.remindersEnabled,
    morningEnabled: merged.morningEnabled,
    breakfastEnabled: merged.breakfastEnabled,
    lunchEnabled: merged.lunchEnabled,
    dinnerEnabled: merged.dinnerEnabled,
    eveningEnabled: merged.eveningEnabled,
    waterEnabled: merged.waterEnabled,
    morningTime: merged.morningTime,
    breakfastTime: merged.breakfastTime,
    lunchTime: merged.lunchTime,
    dinnerTime: merged.dinnerTime,
    eveningTime: merged.eveningTime,
    quietStart: merged.quietStart,
    quietEnd: merged.quietEnd,
    waterIntervalHours: merged.waterIntervalHours,
    timezone: merged.timezone,
  });
  if (patch.timezone && patch.timezone !== user.timezone) {
    await repository.updateUser(user.id, { timezone: patch.timezone });
  }
  return { ...saved, schedule: REMINDER_META, quietHours: { start: saved.quietStart, end: saved.quietEnd } };
}

export function dueReminders(settings, now = new Date(), catchUpMinutes = 2) {
  const timezone = settings.timezone || 'Asia/Omsk';
  const date = localDate(now, timezone);
  const time = localTime(now, timezone);
  const nowMinutes = minutesFromTime(time);
  const quiet = isQuietHours(time, settings.quietStart, settings.quietEnd);
  const due = [];

  if (!settings.remindersEnabled || quiet) return { date, time, quiet, due };

  for (const type of REMINDER_TYPES) {
    const meta = REMINDER_META[type];
    if (!settings[meta.enabledKey]) continue;

    if (type === 'water') {
      const interval = Math.max(1, Number(settings.waterIntervalHours || 3));
      const intervalMinutes = interval * 60;
      const elapsed = nowMinutes - minutesFromTime('09:00');
      if (elapsed < 0 || elapsed > 12 * 60) continue;
      if (elapsed % intervalMinutes > catchUpMinutes) continue;
      const slot = Math.floor(elapsed / intervalMinutes);
      due.push({ type, scheduledAt: `09:00+${slot}*${interval}h`, dedupeKey: `water-${date}-${slot}` });
      continue;
    }

    const scheduledTime = settings[meta.timeKey];
    if (!scheduledTime) continue;
    const diff = nowMinutes - minutesFromTime(scheduledTime);
    if (diff < 0 || diff > catchUpMinutes) continue;
    due.push({
      type,
      scheduledAt: scheduledTime,
      dedupeKey: `${type}-${date}-${scheduledTime}`,
    });
  }
  return { date, time, quiet, due };
}

function reminderText(type, user) {
  const name = user.firstName ? `, ${user.firstName}` : '';
  switch (type) {
    case 'morning':
      return (
        `☀️ <b>Доброе утро${name}!</b>\n\n` +
        'Новый день уже в CALORIA. Загляните в приложение, когда будет удобно — без спешки.'
      );
    case 'breakfast':
      return '🍳 <b>Завтрак</b>\n\nКогда будет удобно, добавьте завтрак в дневник — так статистика будет точнее.';
    case 'lunch':
      return '🥗 <b>Обед</b>\n\nНебольшое напоминание добавить обед в дневник, если ещё не сделали этого.';
    case 'dinner':
      return '🍽️ <b>Ужин</b>\n\nМожно добавить ужин в дневник. Даже примерная запись лучше, чем пропуск.';
    case 'evening':
      return '🌙 <b>Как прошёл день?</b>\n\nЕсли удобно, проверьте дневник и добавьте то, что осталось. Без давления и оценок.';
    case 'water':
      return '💧 <b>Немного воды</b>\n\nСделайте небольшой глоток, если хочется. Ориентируйтесь на жажду и самочувствие.';
    default:
      return 'Напоминание CALORIA';
  }
}

function appKeyboard(config) {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: 'ОТКРЫТЬ CALORIA', url: config.miniAppUrl }]],
    },
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  };
}

async function shouldSkipForMeal(repository, user, type, date) {
  const meta = REMINDER_META[type];
  if (!meta?.meal) return false;
  try {
    const entries = await getEntriesForDate(repository, user, date);
    return entries.some((entry) => entry.mealType === meta.meal);
  } catch {
    return false;
  }
}

/**
 * Sends any reminders that became due within the catch-up window.
 * A unique dedupe key in notification_logs guarantees at-most-once delivery.
 */
export async function runReminders({
  repository,
  bot,
  config,
  now = new Date(),
  catchUpMinutes = 2,
}) {
  if (!bot) return { sent: 0, skipped: 0, failed: 0, users: 0, reason: 'bot-not-configured' };
  const users = await repository.listUsersForScheduling();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const { user, reminders } of users) {
    const settings = {
      ...defaultReminderSettings(user.id, user.timezone),
      ...reminders,
      timezone: reminders?.timezone || user.timezone,
    };
    let result;
    try {
      result = dueReminders(settings, now, catchUpMinutes);
    } catch (error) {
      logger.warn('Reminder schedule error', { userId: user.id, reason: error.message });
      continue;
    }
    if (result.quiet) {
      continue;
    }

    for (const item of result.due) {
      const existing = await repository.getNotificationLog(user.id, item.dedupeKey);
      if (existing) {
        skipped += 1;
        continue;
      }
      const skipMeal = await shouldSkipForMeal(repository, user, item.type, result.date);
      if (skipMeal) {
        skipped += 1;
        continue;
      }
      try {
        await bot.telegram.sendMessage(user.telegramId, reminderText(item.type, user), appKeyboard(config));
        await repository.createNotificationLog({
          userId: user.id,
          notificationType: item.type,
          dedupeKey: item.dedupeKey,
          scheduledAt: `${result.date}T${result.time}:00`,
          sentAt: new Date().toISOString(),
          status: 'sent',
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        logger.warn('Reminder delivery failed', {
          userId: user.id,
          type: item.type,
          reason: error.message,
        });
        // Mark failures too, to avoid a retry storm against blocked chats.
        await repository
          .createNotificationLog({
            userId: user.id,
            notificationType: item.type,
            dedupeKey: item.dedupeKey,
            scheduledAt: `${result.date}T${result.time}:00`,
            status: 'failed',
          })
          .catch(() => {});
      }
    }
  }
  return { sent, skipped, failed, users: users.length };
}

export function startScheduler({ repository, bot, config }) {
  let running = false;
  const tick = async (catchUpMinutes = 2) => {
    if (running) return;
    running = true;
    try {
      const result = await runReminders({ repository, bot, config, catchUpMinutes });
      if (result.sent || result.failed) logger.info('Reminder tick complete', result);
    } catch (error) {
      logger.error('Reminder tick failed', { reason: error.message });
    } finally {
      running = false;
    }
  };

  // Local import avoids pulling node-cron into pure unit tests.
  const cronPromise = import('node-cron').then(({ default: cron }) => {
    const task = cron.schedule('* * * * *', () => tick(2), { timezone: 'UTC' });
    logger.info('Reminder scheduler started', { cadence: 'every minute' });
    return task;
  });

  return {
    runNow: (catchUpMinutes = 15) => tick(catchUpMinutes),
    stop: async () => {
      const task = await cronPromise;
      task?.stop();
    },
  };
}
