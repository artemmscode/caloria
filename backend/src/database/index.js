import path from 'node:path';
import { SupabaseRepository } from './supabase.repository.js';
import { JsonRepository } from './memory.repository.js';
import { logger } from '../utils/logger.js';

/**
 * Creates the production Supabase repository, or a durable JSON repository for
 * local development when Supabase is not configured. The JSON store is never
 * used when NODE_ENV=production (config validation requires Supabase there).
 */
export async function createRepository(config) {
  if (config.hasSupabase) {
    const repository = new SupabaseRepository({
      url: config.supabaseUrl,
      serviceRoleKey: config.supabaseServiceRoleKey,
    });
    await repository.init();
    logger.info('Database connected', { provider: 'supabase' });
    return repository;
  }

  const filePath = path.resolve(process.cwd(), config.devDataDir, 'caloria.json');
  const repository = new JsonRepository({ filePath });
  await repository.init();
  logger.warn('Supabase is not configured — using local JSON storage', {
    filePath,
    note: 'Development only. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for real data.',
  });
  return repository;
}
