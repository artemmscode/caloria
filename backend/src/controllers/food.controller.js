import { asyncHandler } from '../utils/errors.js';
import {
  searchFoods,
  getFoodForUser,
  createCustomFood,
  getFoodDiscovery,
  toggleFavorite,
} from '../services/food.service.js';

export function createFoodController({ repository, config }) {
  return {
    search: asyncHandler(async (req, res) => {
      const items = await searchFoods(repository, req.userId, req.query.q, config, {
        limit: req.query.limit,
        includeExternal: req.query.external !== '0',
      });
      res.json({ ok: true, data: { items, query: req.query.q } });
    }),
    discovery: asyncHandler(async (req, res) => {
      res.json({ ok: true, data: await getFoodDiscovery(repository, req.userId, config) });
    }),
    get: asyncHandler(async (req, res) => {
      res.json({ ok: true, data: await getFoodForUser(repository, req.userId, req.params.id) });
    }),
    custom: asyncHandler(async (req, res) => {
      const product = await createCustomFood(repository, req.userId, req.body);
      res.status(201).json({ ok: true, data: product });
    }),
    recent: asyncHandler(async (req, res) => {
      res.json({
        ok: true,
        data: { items: await repository.recentFoods(req.userId, req.query.limit) },
      });
    }),
    favorites: asyncHandler(async (req, res) => {
      res.json({ ok: true, data: { items: await repository.listFavorites(req.userId) } });
    }),
    toggleFavorite: asyncHandler(async (req, res) => {
      res.json({
        ok: true,
        data: await toggleFavorite(repository, req.userId, req.params.productId),
      });
    }),
  };
}
