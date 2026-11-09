import express from 'express';
import { validateBody } from '../middleware/validate.js';
import { profileSchema, goalsSchema } from '../middleware/schemas.js';
import { createUserController } from '../controllers/user.controller.js';

export function createUserRoutes({ repository, auth }) {
  const router = express.Router();
  const controller = createUserController({ repository });
  router.use(auth);
  router.get('/profile', controller.get);
  router.post('/profile', validateBody(profileSchema), controller.save);
  router.post('/plan-preview', validateBody(profileSchema), controller.preview);
  router.get('/plan', controller.plan);
  router.put('/goals', validateBody(goalsSchema), controller.goals);
  return router;
}
