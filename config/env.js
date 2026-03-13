/**
 * Env validation and helpers. Call validateEnv() at app startup.
 */

const required = [
  'JWT_SECRET',
];

const atLeastOne = [
  ['MONGO_URL', 'FALLBACK_MONGO_URL'],
];

export const isProduction = process.env.NODE_ENV === 'production';

/** Quiz API: base URL and auth. Use QUIZ_API_AUTH_HEADER for exact header (e.g. "Bearer quiz_dev_token") or QUIZ_API_TOKEN for "Bearer <token>". */
export const QUIZ_API_BASE_URL = (process.env.QUIZ_API_BASE_URL || '').replace(/\/quizzes\/?$/, '') || process.env.QUIZ_API_BASE_URL || '';
export const QUIZ_API_TOKEN = (process.env.QUIZ_API_TOKEN || '').trim();
export const QUIZ_API_AUTH_PREFIX = isProduction ? 'qza_live_' : 'qza_test_';
const authHeaderRaw = (process.env.QUIZ_API_AUTH_HEADER || '').trim();
export const QUIZ_API_AUTH_HEADER = authHeaderRaw
  ? authHeaderRaw.startsWith('Bearer ') ? authHeaderRaw : `Bearer ${authHeaderRaw}`
  : QUIZ_API_TOKEN ? `Bearer ${QUIZ_API_TOKEN}` : '';

export function validateEnv() {
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    console.error('[env] Missing required env vars:', missing.join(', '));
    process.exit(1);
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 8) {
    console.error('[env] JWT_SECRET must be set and at least 8 characters.');
    process.exit(1);
  }
  if (isProduction && process.env.JWT_SECRET.length < 16) {
    console.warn('[env] JWT_SECRET should be at least 16 characters in production.');
  }
  for (const group of atLeastOne) {
    const hasOne = group.some((key) => process.env[key]?.trim());
    if (!hasOne) {
      console.error('[env] At least one of', group.join(', '), 'must be set.');
      process.exit(1);
    }
  }
}

/**
 * CORS origin: allow FRONTEND_URL or list, else in dev allow true for local testing.
 */
export function getCorsOrigin() {
  const url = process.env.FRONTEND_URL || process.env.FRONTEND_URL_DEV || process.env.FRONTEND_URL_PROD;
  if (url) return url.split(',').map((u) => u.trim()).filter(Boolean);
  if (isProduction) return [];
  return true; // dev: reflect request origin
}
