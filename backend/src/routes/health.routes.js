import express from 'express';
import { createHealthController } from '../controllers/health.controller.js';
import { verifyCronSecret } from '../middleware/security.js';

export function createHealthRoutes({ repository, config, bot, scheduler }) {
  const router = express.Router();
  const controller = createHealthController({ repository, config, bot, scheduler });
  router.get('/health', controller.health);
  router.post('/cron/tick', verifyCronSecret(config), controller.cronTick);
  return router;
}
