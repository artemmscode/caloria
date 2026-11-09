import express from 'express';
import { validateQuery } from '../middleware/validate.js';
import { dashboardQuerySchema, periodSchema } from '../middleware/schemas.js';
import { createDashboardController } from '../controllers/dashboard.controller.js';

export function createStatsRoutes({ repository, auth }) {
  const router = express.Router();
  const controller = createDashboardController({ repository });
  router.use(auth);
  router.get('/dashboard', validateQuery(dashboardQuerySchema), controller.get);
  router.get('/statistics', validateQuery(periodSchema), controller.statistics);
  return router;
}
