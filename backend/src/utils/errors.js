export class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = status < 500;
  }
}

export const badRequest = (message, details) =>
  new AppError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Требуется авторизация') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Недостаточно прав') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Не найдено') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (message) => new AppError(409, 'CONFLICT', message);
export const tooMany = (message = 'Слишком много запросов. Попробуйте позже.') =>
  new AppError(429, 'RATE_LIMITED', message);
export const upstream = (message = 'Внешний сервис недоступен') =>
  new AppError(502, 'UPSTREAM_ERROR', message);

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
