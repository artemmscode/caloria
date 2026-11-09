import express from 'express';
import { createAuthRoutes } from './auth.routes.js';
import { createUserRoutes } from './user.routes.js';
import { createFoodRoutes } from './food.routes.js';
import { createDiaryRoutes } from './diary.routes.js';
import { createStatsRoutes } from './stats.routes.js';
import { createProgressRoutes } from './progress.routes.js';
import { createRemindersRoutes } from './reminders.routes.js';
import { createWaterRoutes } from './water.routes.js';
import { createHealthRoutes } from './health.routes.js';

export function createApiRouter({ repository, config, auth, bot, scheduler }) {
  const router = express.Router();
  router.use(createHealthRoutes({ repository, config, bot, scheduler }));
  router.use('/auth', createAuthRoutes({ repository, config }));
  router.use('/user', createUserRoutes({ repository, auth }));
  router.use('/food', createFoodRoutes({ repository, config, auth }));
  router.use('/diary', createDiaryRoutes({ repository, auth }));
  router.use('/reminders', createRemindersRoutes({ repository, auth }));
  router.use('/water', createWaterRoutes({ repository, auth }));
  router.use(createStatsRoutes({ repository, auth }));
  router.use(createProgressRoutes({ repository, auth }));
  return router;
}
