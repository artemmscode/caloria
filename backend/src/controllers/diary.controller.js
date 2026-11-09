import { asyncHandler } from '../utils/errors.js';
import {
  buildDiary,
  addEntry,
  updateEntry,
  deleteEntry,
  copyDay,
  getPreviousDateWithEntries,
} from '../services/diary.service.js';
import { localDate } from '../utils/time.js';

export function createDiaryController({ repository }) {
  return {
    get: asyncHandler(async (req, res) => {
      res.json({ ok: true, data: await buildDiary(repository, req.user, req.params.date) });
    }),
    add: asyncHandler(async (req, res) => {
      const entry = await addEntry(repository, req.user, req.body);
      res.status(201).json({ ok: true, data: { entry } });
    }),
    update: asyncHandler(async (req, res) => {
      const entry = await updateEntry(repository, req.user, req.params.id, req.body);
      res.json({ ok: true, data: { entry } });
    }),
    remove: asyncHandler(async (req, res) => {
      await deleteEntry(repository, req.user, req.params.id);
      res.json({ ok: true, data: { deleted: true } });
    }),
    copy: asyncHandler(async (req, res) => {
      const entries = await copyDay(repository, req.user, req.body);
      res.status(201).json({ ok: true, data: { entries, count: entries.length } });
    }),
    previous: asyncHandler(async (req, res) => {
      const date = req.query.date || localDate(new Date(), req.user.timezone);
      res.json({ ok: true, data: await getPreviousDateWithEntries(repository, req.user, date) });
    }),
  };
}
