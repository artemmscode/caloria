import express from 'express';
import { validateBody } from '../middleware/validate.js';
import { authSchema, devAuthSchema } from '../middleware/schemas.js';
import { createAuthController } from '../controllers/auth.controller.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

export function createAuthRoutes({ repository, config }) {
  const router = express.Router();
  const controller = createAuthController({ repository, config });
  const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });
  router.post('/telegram', limiter, validateBody(authSchema), controller.telegram);
  router.post('/dev', limiter, validateBody(devAuthSchema), controller.dev);
  return router;
}
