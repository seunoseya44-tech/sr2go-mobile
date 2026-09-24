import { jwtDecode } from 'jwt-decode';

export interface JwtClaims {
  sub?: string;
  exp?: number;
  iat?: number;
  email?: string;
  role?: string;
  [claim: string]: unknown;
}

/** Decodes claims without verifying the signature (only the server can do that). */
export function decodeJwt(token: string): JwtClaims | null {
  try {
    return jwtDecode<JwtClaims>(token);
  } catch {
    return null;
  }
}

/** Expiry as epoch milliseconds, or null when the token has no `exp`. */
export function getExpiry(token: string): number | null {
  const exp = decodeJwt(token)?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}

/**
 * True when the token is expired or will expire within `skewMs`. The skew
 * covers clock drift and the request's own flight time. Tokens without an
 * `exp` claim are treated as valid; the server stays the source of truth.
 */
export function isExpired(token: string, skewMs = 30_000, now = Date.now()): boolean {
  const expiry = getExpiry(token);
  return expiry !== null && expiry - skewMs <= now;
}
