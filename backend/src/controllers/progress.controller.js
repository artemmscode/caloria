import { asyncHandler } from '../utils/errors.js';
import { getProgress } from '../services/stats.service.js';
import { localDate } from '../utils/time.js';
import { notFound } from '../utils/errors.js';

export function createProgressController({ repository }) {
  return {
    overview: asyncHandler(async (req, res) => {
      res.json({ ok: true, data: await getProgress(repository, req.user, { period: req.query.period }) });
    }),
    addWeight: asyncHandler(async (req, res) => {
      const date = req.body.date || localDate(new Date(), req.user.timezone);
      const item = await repository.upsertWeight(req.userId, {
        weight: req.body.weight,
        recordedOn: date,
        recordedAt: new Date().toISOString(),
      });
      await repository.updateUser(req.userId, { weight: req.body.weight });
      res.status(201).json({ ok: true, data: item });
    }),
    deleteWeight: asyncHandler(async (req, res) => {
      const deleted = await repository.deleteWeight(req.userId, req.params.id);
      if (!deleted) throw notFound('Запись веса не найдена');
      res.json({ ok: true, data: { deleted: true } });
    }),
    addMeasurement: asyncHandler(async (req, res) => {
      const date = req.body.date || localDate(new Date(), req.user.timezone);
      const item = await repository.upsertMeasurement(req.userId, {
        recordedOn: date,
        waist: req.body.waist ?? null,
        hips: req.body.hips ?? null,
        chest: req.body.chest ?? null,
        note: req.body.note ?? null,
      });
      res.status(201).json({ ok: true, data: item });
    }),
    deleteMeasurement: asyncHandler(async (req, res) => {
      const deleted = await repository.deleteMeasurement(req.userId, req.params.id);
      if (!deleted) throw notFound('Измерения не найдены');
      res.json({ ok: true, data: { deleted: true } });
    }),
    addPhoto: asyncHandler(async (req, res) => {
      const date = req.body.date || localDate(new Date(), req.user.timezone);
      const item = await repository.createPhoto(req.userId, {
        recordedOn: date,
        dataUrl: req.body.dataUrl,
        note: req.body.note || null,
      });
      res.status(201).json({ ok: true, data: item });
    }),
    deletePhoto: asyncHandler(async (req, res) => {
      const deleted = await repository.deletePhoto(req.userId, req.params.id);
      if (!deleted) throw notFound('Фото не найдено');
      res.json({ ok: true, data: { deleted: true } });
    }),
  };
}
