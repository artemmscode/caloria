import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    ok: false,
    error: { code: 'NOT_FOUND', message: 'Маршрут не найден' },
  });
}

export function createErrorHandler(config) {
  return function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);

    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Внутренняя ошибка сервера';
    let details;

    if (error instanceof AppError) {
      status = error.status;
      code = error.code;
      message = error.message;
      details = error.details;
    } else if (error?.name === 'ZodError') {
      status = 400;
      code = 'VALIDATION_ERROR';
      message = 'Проверьте введённые данные';
      details = error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
    } else if (error?.type === 'entity.parse.failed') {
      status = 400;
      code = 'INVALID_JSON';
      message = 'Некорректный JSON';
    } else if (error?.type === 'entity.too.large') {
      status = 413;
      code = 'PAYLOAD_TOO_LARGE';
      message = 'Слишком большой запрос';
    }

    if (status >= 500) {
      logger.error('Unhandled request error', {
        requestId: req.id,
        method: req.method,
        path: req.path,
        code: error?.code,
        reason: error?.message,
        stack: config.isProduction ? undefined : error?.stack,
      });
    }

    res.status(status).json({
      ok: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        requestId: req.id,
      },
    });
  };
}
