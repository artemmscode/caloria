import http from 'node:http';
import { config, describeConfig } from './config/index.js';
import { createRepository } from './database/index.js';
import { createApp } from './app.js';
import { createBot, configureBotProfile } from './bot.js';
import { startScheduler } from './services/reminder.service.js';
import { logger } from './utils/logger.js';

async function main() {
  logger.info('Starting CALORIA backend', describeConfig(config));

  const repository = await createRepository(config);
  const bot = createBot({ config, repository });
  let scheduler = null;

  if (bot) {
    if (config.webhookUrl) {
      await bot.telegram.setWebhook(`${config.webhookUrl}/telegram/webhook`, {
        secret_token: config.webhookSecret || undefined,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: false,
      });
      logger.info('Telegram webhook registered', { url: `${config.webhookUrl}/telegram/webhook` });
    } else if (!config.isProduction) {
      // Telegraf's launch() resolves only when polling stops, so it must not be
      // awaited here: the HTTP server still has to start in parallel.
      bot.launch({ dropPendingUpdates: false }).catch((error) => {
        logger.error('Telegram polling stopped', { reason: error.message });
      });
      logger.info('Telegram bot starting in polling mode (development)');
    } else {
      logger.error('WEBHOOK_URL is required in production; bot not started');
    }
    await configureBotProfile(bot, config);
  }

  if (config.schedulerEnabled && bot) {
    scheduler = startScheduler({ repository, bot, config });
  }

  const app = createApp({ repository, config, bot, scheduler });
  const server = http.createServer(app);
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, '0.0.0.0', () => {
      server.off('error', reject);
      resolve();
    });
  });
  logger.info('HTTP server listening', { port: config.port });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutdown started', { signal });
    const force = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 12_000);
    force.unref();
    try {
      await new Promise((resolve) => server.close(resolve));
      await scheduler?.stop();
      if (bot) {
        try {
          await bot.stop(signal);
        } catch {
          // Polling may not be running in webhook mode.
        }
      }
      await repository.close?.();
      logger.info('Shutdown complete');
      clearTimeout(force);
      process.exit(0);
    } catch (error) {
      logger.error('Shutdown failed', { reason: error.message });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason: reason?.message || String(reason) });
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { reason: error.message });
    shutdown('uncaughtException');
  });
}

main().catch((error) => {
  logger.error('Fatal startup error', { reason: error.message });
  process.exit(1);
});
