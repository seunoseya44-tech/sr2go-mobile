/**
 * Runtime configuration.
 *
 * Expo inlines `EXPO_PUBLIC_*` variables at build time, so every value must be
 * read with a static `process.env.EXPO_PUBLIC_X` expression (no dynamic keys).
 */

const DEFAULT_API_BASE_URL = 'https://shareride2go.com';
const DEFAULT_TIMEOUT_MS = 15_000;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export const env = {
  apiBaseUrl: stripTrailingSlash(process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL),
  apiTimeoutMs: toPositiveInt(process.env.EXPO_PUBLIC_API_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
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
