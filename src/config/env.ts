/**
 * Runtime configuration.
 *
 * Expo inlines `EXPO_PUBLIC_*` variables at build time, so every value must be
 * read with a static `process.env.EXPO_PUBLIC_X` expression (no dynamic keys).
 */

import { Platform } from 'react-native';

const DEFAULT_API_BASE_URL = 'https://shareride2go.com';
// The brief requires at least 30 s: the first request after the server has
// been idle can take several seconds.
const DEFAULT_TIMEOUT_MS = 30_000;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const configuredApiBaseUrl = stripTrailingSlash(
  process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL,
);

export const env = {
  /**
   * In the web dev preview, requests go same-origin and the Metro dev server
   * proxies `/api/*` to the real API (see metro.config.js), because the API's
   * CORS policy only allows https://shareride2go.com. Native apps aren't
   * subject to CORS and always call the API directly.
   */
  apiBaseUrl: __DEV__ && Platform.OS === 'web' ? '' : configuredApiBaseUrl,
  apiTimeoutMs: Math.max(
    30_000,
    toPositiveInt(process.env.EXPO_PUBLIC_API_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  ),
  /** Website pages opened from the app (privacy, terms, help). */
  websiteUrl: DEFAULT_API_BASE_URL,
  /**
   * Dev-only convenience to prefill the login form. Wrapped in `__DEV__` so the
   * minifier strips the values from release bundles entirely.
   */
  devTestCredentials: __DEV__
    ? {
        email: process.env.EXPO_PUBLIC_DEV_TEST_EMAIL ?? '',
        password: process.env.EXPO_PUBLIC_DEV_TEST_PASSWORD ?? '',
      }
    : { email: '', password: '' },
} as const;
