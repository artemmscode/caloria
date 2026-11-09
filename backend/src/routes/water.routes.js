import express from 'express';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { waterSchema } from '../middleware/schemas.js';
import { createWaterController } from '../controllers/water.controller.js';
import { z } from 'zod';

const waterQuery = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

export function createWaterRoutes({ repository, auth }) {
  const router = express.Router();
  const controller = createWaterController({ repository });
  router.use(auth);
  router.get('/', validateQuery(waterQuery), controller.get);
  router.post('/', validateBody(waterSchema), controller.update);
  return router;
}
