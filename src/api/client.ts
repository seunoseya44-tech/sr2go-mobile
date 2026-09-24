import { create, type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { env } from '../config/env';
import { session } from '../auth/session';
import { toApiError } from './errors';
import { parseTokens } from './parsers';
import type { AuthTokens } from './types';

export const ENDPOINTS = {
  login: '/api/auth/login',
  refresh: '/api/auth/refresh',
  me: '/api/auth/me',
} as const;

/** Endpoints where a 401 means "bad credentials", not "session expired". */
const NO_REFRESH = new Set<string>([ENDPOINTS.login, ENDPOINTS.refresh]);

const baseConfig = {
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
};

export const http = create(baseConfig);

/** Bare instance for the refresh call so it never re-enters the interceptors. */
const refreshHttp = create(baseConfig);

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Let a 401 fail this request without refreshing or ending the session. */
    skipSessionHandling?: boolean;
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

function handlesSession(config: RetriableConfig | undefined): config is RetriableConfig {
  return !!config && !config.skipSessionHandling && !NO_REFRESH.has(config.url ?? '');
}

http.interceptors.request.use((config) => {
  const tokens = session.getTokens();
  if (tokens && !NO_REFRESH.has(config.url ?? '')) {
    config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }
  return config;
});

/**
 * Single-flight refresh: when several requests fail with 401 at the same time
 * they all wait on one refresh call instead of each firing their own (which
 * would invalidate each other's refresh tokens if the server rotates them).
 */
let refreshInFlight: Promise<AuthTokens> | null = null;

export function refreshTokens(): Promise<AuthTokens> {
  const refreshToken = session.getTokens()?.refreshToken;
  if (!refreshToken) return Promise.reject(new Error('No refresh token'));

  refreshInFlight ??= refreshHttp
    .post(ENDPOINTS.refresh, { refresh_token: refreshToken })
    .then(async ({ data }) => {
      const next = parseTokens(data);
      // Some servers only rotate the access token; keep the old refresh token.
      const tokens = { ...next, refreshToken: next.refreshToken ?? refreshToken };
      await session.save(tokens);
      return tokens;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const isAuthFailure = error.response?.status === 401;

    if (isAuthFailure && handlesSession(config) && !config._retried) {
      config._retried = true;
      try {
        const tokens = await refreshTokens();
        config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
        return http(config);
      } catch {
        await session.expire();
        return Promise.reject(toApiError(error));
      }
    }

    if (isAuthFailure && handlesSession(config)) {
      await session.expire();
    }
    return Promise.reject(toApiError(error));
  },
);
