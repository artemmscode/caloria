/**
 * Regenerates database/migrations/002_seed_foods.sql from the backend seed.
 * Usage: node database/generate-seed.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedFoods } from '../backend/src/database/seedFoods.js';
import { buildSearchText, normalizeFoodName } from '../backend/src/utils/foodText.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const q = (value) => `'${String(value).replace(/'/g, "''")}'`;

const rows = seedFoods.map((food) => {
  const aliases = food.aliases.length
    ? `array[${food.aliases.map(q).join(', ')}]::text[]`
    : `'{}'::text[]`;
  return `  (${q(food.name)}, ${q(normalizeFoodName(food.name))}, ${q(buildSearchText(food.name, food.aliases))}, ${food.calories}, ${food.protein}, ${food.fat}, ${food.carbohydrates}, ${q(food.source)}, ${q(food.sourceId)}, ${q(food.category)}, ${q(food.emoji)}, ${aliases}, ${food.defaultServingGrams}, ${food.pieceGrams ?? 'null'}, true)`;
});

const sql = `-- ============================================================================
-- CALORIA — curated reference food database (values per 100 g)
-- Generated from backend/src/database/seedFoods.js
-- Values are rounded public reference data, not brand-specific exact values.
-- Re-run safely: duplicates are ignored.
-- ============================================================================

insert into public.food_products (
  name, name_normalized, search_text, calories, protein, fat, carbohydrates,
  source, source_id, category, emoji, aliases, default_serving_grams, piece_grams, is_public
) values
${rows.join(',\n')}
on conflict do nothing;
`;

await fs.writeFile(path.join(__dirname, 'migrations', '002_seed_foods.sql'), sql, 'utf8');
console.log(`Wrote ${seedFoods.length} foods to database/migrations/002_seed_foods.sql`);
