import { asyncHandler } from '../utils/errors.js';
import { getProfile, saveProfile, updateGoals, getPlanPreview, previewPlan } from '../services/user.service.js';

export function createUserController({ repository }) {
  return {
    get: asyncHandler(async (req, res) => {
      res.json({ ok: true, data: await getProfile(repository, req.userId) });
    }),
    save: asyncHandler(async (req, res) => {
      const result = await saveProfile(repository, req.userId, req.body);
      res.json({ ok: true, data: result });
    }),
    goals: asyncHandler(async (req, res) => {
      const goals = await updateGoals(repository, req.userId, req.body);
      res.json({ ok: true, data: { goals } });
    }),
    plan: asyncHandler(async (req, res) => {
      res.json({ ok: true, data: await getPlanPreview(repository, req.userId) });
    }),
    preview: asyncHandler(async (req, res) => {
      res.json({ ok: true, data: previewPlan(req.body) });
    }),
  };
}
