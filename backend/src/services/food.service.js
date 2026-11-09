import { logger } from '../utils/logger.js';
import { notFound } from '../utils/errors.js';
import { normalizeFoodName } from '../utils/foodText.js';

const USDA_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1/foods/search';

function nutrientValue(foodNutrients, numbers) {
  const found = (foodNutrients || []).find((item) => numbers.includes(String(item.nutrientNumber)));
  return Number(found?.value || 0);
}

function mapUsdaFood(item) {
  const calories = nutrientValue(item.foodNutrients, ['208', '1008']);
  return {
    name: item.description ? item.description.toLowerCase().replace(/(^|\s)\S/g, (s) => s.toUpperCase()) : 'Продукт USDA',
    calories: Math.round(calories * 10) / 10,
    protein: Math.round(nutrientValue(item.foodNutrients, ['203', '1003']) * 10) / 10,
    fat: Math.round(nutrientValue(item.foodNutrients, ['204', '1004']) * 10) / 10,
    carbohydrates: Math.round(nutrientValue(item.foodNutrients, ['205', '1005']) * 10) / 10,
  };
}

/**
 * Optional live food lookup. Results are cached in PostgreSQL with source=usda.
 * If the key is absent or the service fails, the app silently falls back to the
 * verified local reference database.
 */
export async function searchExternalFoods(repository, query, config, limit = 8) {
  if (!config.foodApiKey || query.trim().length < 2) return [];
  const url = new URL(USDA_ENDPOINT);
  url.searchParams.set('api_key', config.foodApiKey);
  url.searchParams.set('query', query.trim());
  url.searchParams.set('pageSize', String(limit));
  url.searchParams.set('dataType', 'Foundation,SR Legacy');

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`USDA responded ${response.status}`);
    const payload = await response.json();
    const results = [];
    for (const item of payload.foods || []) {
      if (!item.fdcId) continue;
      const existing = await repository.findPublicFoodBySource('usda', String(item.fdcId));
      if (existing) {
        results.push({ ...existing, external: true });
        continue;
      }
      const mapped = mapUsdaFood(item);
      if (!mapped.calories) continue;
      try {
        const saved = await repository.createFood({
          ...mapped,
          name: mapped.name.slice(0, 120),
          source: 'usda',
          sourceId: String(item.fdcId),
          category: 'USDA FoodData Central',
          emoji: '🌎',
          aliases: [item.description].filter(Boolean),
          isPublic: true,
        });
        results.push({ ...saved, external: true });
      } catch {
        // Unique conflict from a concurrent request; skip caching this item.
      }
    }
    return results;
  } catch (error) {
    logger.warn('External food API unavailable, using local database', { reason: error.message });
    return [];
  }
}

export async function searchFoods(repository, userId, query, config, options = {}) {
  const limit = options.limit || 25;
  const local = await repository.searchFoods(query, { userId, limit });
  let external = [];
  if (options.includeExternal !== false && query && query.trim().length >= 2) {
    external = await searchExternalFoods(repository, query, config, 6);
  }
  const seen = new Set(local.map((food) => normalizeFoodName(food.name)));
  return [...local, ...external.filter((food) => !seen.has(normalizeFoodName(food.name)))].slice(
    0,
    limit + 6,
  );
}

export async function getFoodForUser(repository, userId, foodId) {
  const food = await repository.getFoodById(foodId);
  if (!food || (!food.isPublic && food.createdBy !== userId)) throw notFound('Продукт не найден');
  return food;
}

export async function createCustomFood(repository, userId, input) {
  return repository.createFood({
    ...input,
    source: 'user',
    category: 'Мои продукты',
    emoji: '🍽️',
    createdBy: userId,
    isPublic: false,
  });
}

export async function getFoodDiscovery(repository, userId, config) {
  const [recent, favorites, popular] = await Promise.all([
    repository.recentFoods(userId, 10),
    repository.listFavorites(userId),
    repository.popularFoods(10),
  ]);
  return { recent, favorites, popular };
}

export async function toggleFavorite(repository, userId, productId) {
  const food = await getFoodForUser(repository, userId, productId);
  const favorites = await repository.listFavorites(userId);
  const exists = favorites.some((item) => item.id === food.id);
  if (exists) await repository.removeFavorite(userId, food.id);
  else await repository.addFavorite(userId, food.id);
  return { favorite: !exists };
}
