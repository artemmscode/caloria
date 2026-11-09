import { asyncHandler } from '../utils/errors.js';
import { getDashboard, getStatistics } from '../services/stats.service.js';
import { localDate } from '../utils/time.js';

export function createDashboardController({ repository }) {
  return {
    get: asyncHandler(async (req, res) => {
      const date = req.query.date || localDate(new Date(), req.user.timezone);
      res.json({ ok: true, data: await getDashboard(repository, req.user, date) });
    }),
    statistics: asyncHandler(async (req, res) => {
      const data = await getStatistics(repository, req.user, req.query.period);
      res.json({ ok: true, data });
    }),
  };
}
