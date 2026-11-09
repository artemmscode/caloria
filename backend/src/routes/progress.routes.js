import express from 'express';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import {
  idParamSchema,
  measurementSchema,
  periodSchema,
  photoSchema,
  weightSchema,
} from '../middleware/schemas.js';
import { createProgressController } from '../controllers/progress.controller.js';

export function createProgressRoutes({ repository, auth }) {
  const router = express.Router();
  const progress = createProgressController({ repository });
  router.use(auth);

  router.get('/progress', validateQuery(periodSchema), progress.overview);

  router.get('/weight', validateQuery(periodSchema), progress.overview);
  router.post('/weight', validateBody(weightSchema), progress.addWeight);
  router.delete('/weight/:id', validateParams(idParamSchema), progress.deleteWeight);

  router.post('/measurements', validateBody(measurementSchema), progress.addMeasurement);
  router.delete('/measurements/:id', validateParams(idParamSchema), progress.deleteMeasurement);

  router.post('/photos', validateBody(photoSchema), progress.addPhoto);
  router.delete('/photos/:id', validateParams(idParamSchema), progress.deletePhoto);

  return router;
}
