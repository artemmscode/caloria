import { asyncHandler } from '../utils/errors.js';
import { getWelcomePhotoStatus } from '../utils/welcomePhoto.js';

export function createHealthController({ repository, config, bot, scheduler }) {
  return {
    health: asyncHandler(async (req, res) => {
      let database = 'ok';
      try {
        if (typeof repository.ping === 'function') await repository.ping();
        else await repository.getUserByTelegramId('__healthcheck__');
      } catch (error) {
        database = 'unavailable';
      }
      const ok = database === 'ok';
      const photo = getWelcomePhotoStatus();
      res.status(ok ? 200 : 503).json({
        ok,
        data: {
          status: ok ? 'healthy' : 'degraded',
          database,
          bot: Boolean(bot),
          scheduler: Boolean(scheduler),
          welcomePhoto: photo.exists,
          welcomePhotoBytes: photo.bytes,
          welcomePhotoError: photo.lastError,
          welcomePhotoErrorAt: photo.lastErrorAt,
          welcomePhotoSuccessAt: photo.lastSuccessAt,
          commit: (process.env.RENDER_GIT_COMMIT || '').slice(0, 7) || null,
          environment: config.nodeEnv,
          uptimeSeconds: Math.round(process.uptime()),
          timestamp: new Date().toISOString(),
        },
      });
    }),
    cronTick: asyncHandler(async (req, res) => {
      if (!scheduler) {
        return res.json({ ok: true, data: { skipped: true, reason: 'scheduler disabled' } });
      }
      const result = await scheduler.runNow(20);
      res.json({ ok: true, data: result });
    }),
  };
}
