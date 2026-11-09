import express from 'express';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { diaryAddSchema, diaryCopySchema, diaryUpdateSchema, idParamSchema, dateParamSchema } from '../middleware/schemas.js';
import { createDiaryController } from '../controllers/diary.controller.js';
import { z } from 'zod';

const previousQuery = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

export function createDiaryRoutes({ repository, auth }) {
  const router = express.Router();
  const controller = createDiaryController({ repository });
  router.use(auth);
  router.post('/copy', validateBody(diaryCopySchema), controller.copy);
  router.get('/previous', validateQuery(previousQuery), controller.previous);
  router.get('/:date', validateParams(dateParamSchema), controller.get);
  router.post('/', validateBody(diaryAddSchema), controller.add);
  router.put('/:id', validateParams(idParamSchema), validateBody(diaryUpdateSchema), controller.update);
  router.delete('/:id', validateParams(idParamSchema), controller.remove);
  return router;
}
