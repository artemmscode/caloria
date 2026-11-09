import express from 'express';
import { validateBody } from '../middleware/validate.js';
import { remindersSchema } from '../middleware/schemas.js';
import { createRemindersController } from '../controllers/reminders.controller.js';

export function createRemindersRoutes({ repository, auth }) {
  const router = express.Router();
  const controller = createRemindersController({ repository });
  router.use(auth);
  router.get('/', controller.get);
  router.put('/', validateBody(remindersSchema), controller.update);
  return router;
}
