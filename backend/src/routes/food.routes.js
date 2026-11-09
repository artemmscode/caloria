import express from 'express';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import {
  customFoodSchema,
  foodSearchSchema,
  idParamSchema,
  paginationSchema,
  productParamSchema,
} from '../middleware/schemas.js';
import { createFoodController } from '../controllers/food.controller.js';

export function createFoodRoutes({ repository, config, auth }) {
  const router = express.Router();
  const controller = createFoodController({ repository, config });
  router.use(auth);
  router.get('/search', validateQuery(foodSearchSchema), controller.search);
  router.get('/discovery', controller.discovery);
  router.get('/recent', validateQuery(paginationSchema), controller.recent);
  router.get('/favorites', controller.favorites);
  router.post('/favorites/:productId', validateParams(productParamSchema), controller.toggleFavorite);
  router.delete('/favorites/:productId', validateParams(productParamSchema), controller.toggleFavorite);
  router.post('/custom', validateBody(customFoodSchema), controller.custom);
  router.get('/:id', validateParams(idParamSchema), controller.get);
  return router;
}
