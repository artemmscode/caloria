import { asyncHandler } from '../utils/errors.js';
import { authenticateWithTelegram, authenticateDev } from '../services/user.service.js';

export function createAuthController({ repository, config }) {
  return {
    telegram: asyncHandler(async (req, res) => {
      const result = await authenticateWithTelegram({
        initData: req.body.initData,
        repository,
        config,
      });
      res.json({ ok: true, data: result });
    }),
    dev: asyncHandler(async (req, res) => {
      const result = await authenticateDev({
        repository,
        config,
        telegramId: req.body?.telegramId,
      });
      res.json({ ok: true, data: result });
    }),
  };
}
