import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const list = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

let ephemeralJwtSecret = null;

/**
 * Builds the application configuration. Throws on missing critical secrets in
 * production instead of silently running insecurely.
 */
export function createConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const errors = [];

  // Render exposes the public service URL automatically. Using it as a fallback
  // removes a common misconfiguration while still allowing an explicit override.
  const renderUrl = (env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
  const webhookUrl = (env.WEBHOOK_URL || renderUrl).replace(/\/+$/, '');

  // Supabase now issues `sb_secret_...` keys (server-side, bypasses RLS).
  // Legacy `service_role` JWTs are still supported as a fallback.
  const supabaseSecretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';

  const requiredInProduction = [
    'BOT_TOKEN',
    'WEBHOOK_SECRET',
    'MINI_APP_URL',
    'SUPABASE_URL',
    'JWT_SECRET',
  ];
  if (isProduction) {
    for (const key of requiredInProduction) {
      if (!env[key]) errors.push(key);
    }
    if (!supabaseSecretKey) errors.push('SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
    if (!webhookUrl) errors.push('WEBHOOK_URL (or RENDER_EXTERNAL_URL)');
  }

  if (errors.length) {
    throw new Error(
      `Missing required production environment variables: ${errors.join(', ')}. ` +
        'See backend/.env.example and README.md.',
    );
  }

  let jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    ephemeralJwtSecret ||= crypto.randomBytes(48).toString('hex');
    jwtSecret = ephemeralJwtSecret;
  }

  const miniAppUrl = env.MINI_APP_URL || 'http://localhost:5500/';
  const apiBaseUrl = (env.API_BASE_URL || renderUrl || `http://localhost:${env.PORT || 3000}`).replace(/\/+$/, '');

  return {
    nodeEnv,
    isProduction,
    isTest: nodeEnv === 'test',
    port: Number(env.PORT || 3000),
    botToken: env.BOT_TOKEN || '',
    webhookSecret: env.WEBHOOK_SECRET || '',
    webhookUrl,
    miniAppUrl,
    apiBaseUrl,
    corsOrigins: list(env.CORS_ORIGINS),
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '30d',
    cronSecret: env.CRON_SECRET || '',
    authMaxAgeSeconds: Number(env.AUTH_MAX_AGE_SECONDS || 86400),
    supabaseUrl: env.SUPABASE_URL || '',
    supabaseServiceRoleKey: supabaseSecretKey,
    foodApiKey: env.FOOD_API_KEY || '',
    openaiApiKey: env.OPENAI_API_KEY || '',
    openaiVisionModel: env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
    enableDevAuth: !isProduction && bool(env.ENABLE_DEV_AUTH, nodeEnv !== 'test'),
    devDataDir: env.DEV_DATA_DIR || './.dev-data',
    defaultTimezone: env.DEFAULT_TIMEZONE || 'Europe/Moscow',
    schedulerEnabled: bool(env.SCHEDULER_ENABLED, true),
    hasSupabase: Boolean(env.SUPABASE_URL && supabaseSecretKey),
  };
}

export const config = createConfig();

export function describeConfig(cfg = config) {
  return {
    nodeEnv: cfg.nodeEnv,
    port: cfg.port,
    database: cfg.hasSupabase ? 'supabase' : 'local-json (development only)',
    devAuth: cfg.enableDevAuth,
    bot: Boolean(cfg.botToken),
    webhook: cfg.webhookUrl || null,
    miniAppUrl: cfg.miniAppUrl,
    externalFoodApi: Boolean(cfg.foodApiKey),
    photoRecognition: Boolean(cfg.openaiApiKey),
  };
}
