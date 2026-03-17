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

/** Production frontend origin (no trailing slash). */
const PRODUCTION_FRONTEND_ORIGIN = 'https://svn.createit.in';
/** Production backend origin for OAuth callbacks (no trailing slash). */
const PRODUCTION_BACKEND_ORIGIN = 'https://createit-zr78.onrender.com';

/**
 * Frontend base URL: from FRONTEND_URL if set, else dev vs prod by NODE_ENV.
 * Use this for redirects (Jira, Google OAuth success, etc.) so one .env works for both environments.
 */
export function getFrontendBaseUrl() {
  const url = (process.env.FRONTEND_URL || '').trim();
  if (url) return url.split(',')[0].trim();
  return isProduction ? PRODUCTION_FRONTEND_ORIGIN : 'http://localhost:5173';
}

/**
 * CORS allowed origins: from FRONTEND_URL (comma-separated) if set, else dev vs prod by NODE_ENV.
 */
export function getCorsOrigin() {
  const url = (process.env.FRONTEND_URL || '').trim();
  if (url) return url.split(',').map((u) => u.trim()).filter(Boolean);
  if (isProduction) return [PRODUCTION_FRONTEND_ORIGIN];
  return true; // dev: reflect request origin
}

/**
 * Atlassian OAuth redirect_uri: from ATLASSIAN_REDIRECT_URI if set, else by NODE_ENV.
 * No need for ATLASSIAN_REDIRECT_URI_PROD — one .env works for dev and prod.
 */
export function getAtlassianRedirectUri() {
  const uri = (process.env.ATLASSIAN_REDIRECT_URI || '').trim();
  if (uri) return uri;
  return isProduction
    ? `${PRODUCTION_BACKEND_ORIGIN}/api/jira/oauth/callback`
    : 'http://localhost:8000/api/jira/oauth/callback';
}

/**
 * Google OAuth callback URL: from GOOGLE_CALLBACK_URL if set, else by NODE_ENV.
 */
export function getGoogleCallbackUrl() {
  const url = (process.env.GOOGLE_CALLBACK_URL || '').trim();
  if (url) return url;
  return isProduction
    ? `${PRODUCTION_BACKEND_ORIGIN}/api/auth/google/callback`
    : 'http://localhost:8000/api/auth/google/callback';
}
