import { asyncHandler } from '../utils/errors.js';
import { localDate } from '../utils/time.js';
import { getGoalsOrDefault } from '../services/diary.service.js';

export function createWaterController({ repository }) {
  return {
    get: asyncHandler(async (req, res) => {
      const date = req.query.date || localDate(new Date(), req.user.timezone);
      const [water, goals] = await Promise.all([
        repository.getWater(req.userId, date),
        getGoalsOrDefault(repository, req.userId),
      ]);
      res.json({ ok: true, data: { ...water, goalMl: goals.waterMl || water.goalMl } });
    }),
    update: asyncHandler(async (req, res) => {
      const date = req.body.date || localDate(new Date(), req.user.timezone);
      const goals = await getGoalsOrDefault(repository, req.userId);
      const goalMl = req.body.goalMl || goals.waterMl || 2000;
      const water =
        req.body.mode === 'set'
          ? await repository.setWater(req.userId, date, req.body.amountMl, goalMl)
          : await repository.addWater(req.userId, date, req.body.amountMl, goalMl);
      res.json({ ok: true, data: water });
    }),
  };
}
