/**
 * Central error handler. Use as last middleware (4-arg).
 * Does not leak stack traces or internal errors in production.
 */

import { isProduction } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';
  const code = err.code;

  if (isProduction) {
    // Log without stack and without sensitive data
    if (status >= 500) console.error('[error]', status, message, code || '');
  } else {
    console.error('[error]', status, message, err.stack || '');
  }

  res.status(status).json({
    success: false,
    message: status >= 500 && isProduction ? 'Internal server error' : message,
    ...(code && !isProduction ? { code } : {}),
  });
}
