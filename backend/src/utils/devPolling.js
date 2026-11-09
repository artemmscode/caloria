import { logger as defaultLogger } from './logger.js';

const LOCAL_WEBHOOK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i;

/**
 * Starts Telegram long polling for local development.
 *
 * `bot.launch()` calls `deleteWebhook` internally, so this guard first checks
 * whether the bot already has a non-local webhook (for example a production
 * Render deployment that shares the same BOT_TOKEN). In that case polling is
 * skipped, because starting it would silently disable the production bot.
 *
 * Returns true when polling was started.
 */
export async function startDevPolling(bot, logger = defaultLogger) {
  let info;
  try {
    info = await bot.telegram.getWebhookInfo();
  } catch (error) {
    logger.warn(
      'Could not read the Telegram webhook state — dev polling disabled to avoid deleting a production webhook',
      { reason: error.message },
    );
    return false;
  }

  if (info?.url && !LOCAL_WEBHOOK.test(info.url)) {
    logger.warn('A production webhook is already registered — skipping dev polling so it stays active', {
      url: info.url,
    });
    return false;
  }

  bot.launch({ dropPendingUpdates: false }).catch((error) => {
    logger.error('Telegram polling stopped', { reason: error.message });
  });
  logger.info('Telegram bot starting in polling mode (development)');
  return true;
}