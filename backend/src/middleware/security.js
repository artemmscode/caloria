import crypto from 'node:crypto';
import { unauthorized } from '../utils/errors.js';

export function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

export function secureHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  );
  next();
}

export function verifyCronSecret(config) {
  return (req, res, next) => {
    const header = req.headers['x-cron-secret'] || '';
    if (!config.cronSecret || typeof header !== 'string') {
      return next(unauthorized('Cron endpoint is not configured'));
    }
    const expected = Buffer.from(config.cronSecret);
    const received = Buffer.from(header);
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      return next(unauthorized('Invalid cron secret'));
    }
    return next();
  };
}

export function verifyTelegramWebhookSecret(config) {
  return (req, res, next) => {
    const received = req.headers['x-telegram-bot-api-secret-token'] || '';
    if (!config.webhookSecret) return next(unauthorized('Webhook is not configured'));
    const expected = Buffer.from(config.webhookSecret);
    const actual = Buffer.from(String(received));
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      return next(unauthorized('Invalid webhook secret'));
    }
    return next();
  };
}
