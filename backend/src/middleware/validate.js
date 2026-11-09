import { badRequest } from '../utils/errors.js';

function run(schema, source, target = 'validated') {
  return (req, res, next) => {
    try {
      const value = schema.parse(req[source]);
      if (target === 'body') req.body = value;
      else if (target === 'query') req.query = value;
      else if (target === 'params') req.params = { ...req.params, ...value };
      else req[target] = value;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const validateBody = (schema) => run(schema, 'body', 'body');
export const validateQuery = (schema) => run(schema, 'query', 'query');
export const validateParams = (schema) => run(schema, 'params', 'params');

export function requireJson(req, res, next) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) {
    return next(badRequest('Ожидается Content-Type: application/json'));
  }
  return next();
}
