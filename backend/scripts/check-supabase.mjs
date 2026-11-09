/*
 * Read-only Supabase schema check.
 *
 * Usage:
 *   npm run db:check                              # uses backend/.env
 *   ENV_FILE=.env.production.local npm run db:check
 *
 * It verifies that every table/column required by CALORIA exists. The expected
 * list is parsed from database/migrations/003_verify_schema.sql, so the checker
 * and the SQL verification stay in sync.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envFile = process.env.ENV_FILE || '.env';
const loaded = dotenv.config({ path: path.resolve(process.cwd(), envFile) });
if (loaded.error) {
  console.error(`Не удалось прочитать ${envFile}: ${loaded.error.message}`);
  process.exit(1);
}

const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!url || !key) {
  console.error(`В ${envFile} не заданы SUPABASE_URL и SUPABASE_SECRET_KEY.`);
  process.exit(1);
}

const manifestPath = path.resolve(process.cwd(), '../database/migrations/003_verify_schema.sql');
let manifest;
try {
  manifest = readFileSync(manifestPath, 'utf8');
} catch (error) {
  console.error(`Не удалось прочитать ${manifestPath}: ${error.message}`);
  process.exit(1);
}

/** @type {Map<string, string[]>} */
const expected = new Map();
for (const match of manifest.matchAll(/\('([a-z_]+)',\s*'([a-z_]+)'\)/g)) {
  const [, table, column] = match;
  if (!expected.has(table)) expected.set(table, []);
  expected.get(table).push(column);
}

if (!expected.size) {
  console.error('Не удалось разобрать список таблиц из 003_verify_schema.sql.');
  process.exit(1);
}

// Supabase secret keys are rejected when the User-Agent looks like a browser.
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'User-Agent': 'CALORIA-Backend/1.0 (node)',
};

console.log(`Проект: ${url}`);
console.log(`Проверяю ${expected.size} таблиц...\n`);

let missingTables = 0;
let brokenTables = 0;

for (const [table, columns] of expected) {
  const query = `${url}/rest/v1/${encodeURIComponent(table)}?select=${columns.join(',')}&limit=0`;
  let response;
  try {
    response = await fetch(query, { headers, signal: AbortSignal.timeout(15000) });
  } catch (error) {
    console.error(`✗ ${table}: сеть недоступна (${error.message})`);
    brokenTables += 1;
    continue;
  }

  if (response.ok) {
    console.log(`✓ ${table} (${columns.length} колонок)`);
    continue;
  }

  const body = await response.text();
  let code = null;
  try {
    code = JSON.parse(body)?.code || null;
  } catch {
    // Non-JSON response.
  }

  if (response.status === 404 || code === 'PGRST205') {
    console.error(`✗ ${table}: таблица не найдена`);
    missingTables += 1;
  } else if (response.status === 401) {
    console.error(`✗ ${table}: 401 — проверьте SUPABASE_SECRET_KEY и User-Agent`);
    brokenTables += 1;
  } else {
    console.error(`✗ ${table}: HTTP ${response.status} ${body.slice(0, 180)}`);
    brokenTables += 1;
  }
}

console.log('');

if (missingTables) {
  console.error(`Не хватает таблиц: ${missingTables}.`);
  console.error('Откройте Supabase → SQL Editor и выполните database/setup_all.sql, затем повторите проверку.');
  process.exit(1);
}
if (brokenTables) {
  console.error(`Не удалось проверить таблиц: ${brokenTables}. Смотрите ошибки выше.`);
  process.exit(1);
}

console.log('Схема CALORIA в порядке: все таблицы и колонки на месте.');