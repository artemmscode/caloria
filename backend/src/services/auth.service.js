import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { unauthorized, badRequest } from '../utils/errors.js';
import { isValidTimeZone, safeTimezone } from '../utils/time.js';

/**
 * Verifies Telegram WebApp initData exactly as described in Telegram docs:
 * secret = HMAC_SHA256("WebAppData", bot_token)
 * hash = HMAC_SHA256(secret, data_check_string)
 */
export function verifyTelegramInitData(initData, botToken, maxAgeSeconds = 86400, now = Date.now()) {
  if (!initData || typeof initData !== 'string') {
    throw unauthorized('Не передан initData Telegram');
  }
  if (!botToken) {
    throw unauthorized('Telegram-авторизация не настроена на сервере');
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) {
    throw unauthorized('Некорректная подпись Telegram');
  }
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => [key, value])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString).digest();
  const received = Buffer.from(receivedHash, 'hex');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    throw unauthorized('Подпись Telegram не прошла проверку');
  }

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || authDate <= 0) {
    throw unauthorized('В данных Telegram отсутствует auth_date');
  }
  const age = Math.floor(now / 1000) - authDate;
  if (age < -60 || age > maxAgeSeconds) {
    throw unauthorized('Сессия Telegram устарела. Откройте приложение заново.');
  }

  let payload;
  try {
    payload = JSON.parse(params.get('user') || 'null');
  } catch {
    throw unauthorized('Некорректные данные пользователя Telegram');
  }
  const telegramId = payload?.id;
  if (!telegramId || !Number.isSafeInteger(Number(telegramId))) {
    throw unauthorized('Не удалось определить пользователя Telegram');
  }

  return {
    telegramId: String(telegramId),
    username: payload.username || null,
    firstName: payload.first_name || null,
    lastName: payload.last_name || null,
    photoUrl: payload.photo_url || null,
    languageCode: payload.language_code || 'ru',
    isPremium: Boolean(payload.is_premium),
    allowsWriteToPm: Boolean(payload.allows_write_to_pm),
    authDate,
    timezone: safeTimezone(params.get('tz') || payload?.timezone, 'Asia/Omsk'),
  };
}

export function issueSessionToken(user, config) {
  return jwt.sign(
    { sub: user.id, telegramId: String(user.telegramId), type: 'caloria-session' },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn, issuer: 'caloria' },
  );
}

export function verifySessionToken(token, config) {
  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: 'caloria' });
    if (payload.type !== 'caloria-session' || !payload.sub) throw new Error('wrong token type');
    return payload;
  } catch {
    throw unauthorized('Сессия истекла. Перезапустите приложение.');
  }
}

export function assertValidTimezone(timezone) {
  if (timezone && !isValidTimeZone(timezone)) {
    throw badRequest('Неизвестный часовой пояс', { field: 'timezone' });
  }
}

export function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    age: user.age,
    height: user.height == null ? null : Number(user.height),
    weight: user.weight == null ? null : Number(user.weight),
    targetWeight: user.targetWeight == null ? null : Number(user.targetWeight),
    sex: user.sex,
    activityLevel: user.activityLevel,
    goal: user.goal,
    timezone: user.timezone,
    onboardingCompleted: Boolean(user.onboardingCompleted),
    createdAt: user.createdAt,
  };
}
