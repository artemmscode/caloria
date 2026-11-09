import { asyncHandler } from '../utils/errors.js';
import { getReminders, updateReminders } from '../services/reminder.service.js';

export function createRemindersController({ repository }) {
  return {
    get: asyncHandler(async (req, res) => {
      res.json({ ok: true, data: await getReminders(repository, req.user) });
    }),
    update: asyncHandler(async (req, res) => {
      const settings = await updateReminders(repository, req.user, req.body);
      res.json({ ok: true, data: settings });
    }),
  };
}
