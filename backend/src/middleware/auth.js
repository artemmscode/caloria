import { verifySessionToken } from '../services/auth.service.js';
import { unauthorized } from '../utils/errors.js';

export function createAuthMiddleware({ repository, config }) {
  return async function authenticate(req, res, next) {
    try {
      const header = req.headers.authorization || '';
      const match = header.match(/^Bearer\s+(.+)$/i);
      if (!match) throw unauthorized();
      const payload = verifySessionToken(match[1], config);
      const user = await repository.getUserById(payload.sub);
      if (!user) throw unauthorized('Пользователь не найден. Откройте приложение заново.');
      req.user = user;
      req.userId = user.id;
      req.auth = payload;
      next();
    } catch (error) {
      next(error);
    }
  };
}
