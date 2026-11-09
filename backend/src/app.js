import express from 'express';
import cors from 'cors';
import { createApiRouter } from './routes/index.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createErrorHandler, notFoundHandler } from './middleware/error.js';
import { createIdempotency, createRateLimiter } from './middleware/rateLimit.js';
import { requestId, secureHeaders } from './middleware/security.js';

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function createApp({ repository, config, bot = null, scheduler = null }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const allowedOrigins = new Set(
    [...config.corsOrigins, originOf(config.miniAppUrl), originOf(config.apiBaseUrl)].filter(Boolean),
  );

  app.use(requestId);
  app.use(secureHeaders);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        if (!config.isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Origin is not allowed by CORS'));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Authorization',
        'Content-Type',
        'X-Idempotency-Key',
        'X-Request-Id',
        'X-Cron-Secret',
      ],
      exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining', 'Retry-After'],
      maxAge: 86400,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  const auth = createAuthMiddleware({ repository, config });
  const apiLimiter = createRateLimiter({ windowMs: 60_000, max: 300 });
  const idempotency = createIdempotency();

  app.use('/api', apiLimiter, idempotency);
  app.use('/api', createApiRouter({ repository, config, auth, bot, scheduler }));

  app.get('/', (req, res) => {
    res.json({
      ok: true,
      data: { name: 'CALORIA API', version: '1.0.0', docs: '/api/health' },
    });
  });

  if (bot) {
    // Telegraf validates both the exact path and Telegram's secret header.
    app.use(
      bot.webhookCallback('/telegram/webhook', {
        secretToken: config.webhookSecret || undefined,
      }),
    );
  }

  app.use(notFoundHandler);
  app.use(createErrorHandler(config));

  return app;
}
