import { ApiError } from './errors';
import type { AuthTokens, User } from './types';

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function str(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  return null;
}

function firstString(source: Json, keys: string[]): string | null {
  for (const key of keys) {
    const value = str(source[key]);
    if (value) return value;
  }
  return null;
}

/** Many APIs wrap payloads in `{ data: {...} }`; accept both shapes. */
function unwrap(payload: unknown): Json {
  if (!isObject(payload)) return {};
  return isObject(payload.data) ? { ...payload, ...payload.data } : payload;
}

/**
 * Reads the token pair from a login/refresh response. Tolerant of the common
 * naming conventions (`access_token`, `token`, `accessToken`) so a harmless
 * backend rename doesn't break sign-in.
 */
export function parseTokens(payload: unknown): AuthTokens {
  const body = unwrap(payload);
  const accessToken = firstString(body, ['access_token', 'accessToken', 'token', 'jwt']);
  if (!accessToken) {
    throw new ApiError('unknown', 'Sign-in succeeded but no access token was returned.');
  }
  return {
    accessToken,
    refreshToken: firstString(body, ['refresh_token', 'refreshToken']),
    tokenType: firstString(body, ['token_type', 'tokenType']) ?? 'bearer',
  };
}

export function parseUser(payload: unknown): User | null {
  const body = unwrap(payload);
  const source = isObject(body.user) ? body.user : body;

  const first = firstString(source, ['first_name', 'firstName']);
  const last = firstString(source, ['last_name', 'lastName', 'surname']);
  const joined = [first, last].filter(Boolean).join(' ') || null;

  const user: User = {
    id: firstString(source, ['id', 'user_id', 'uuid', '_id']),
    email: firstString(source, ['email', 'email_address']),
    fullName: firstString(source, ['full_name', 'fullName', 'name']) ?? joined,
    phone: firstString(source, ['phone', 'phone_number', 'phoneNumber']),
    role: firstString(source, ['role', 'user_type', 'userType', 'account_type']),
    isVerified: readBoolean(source, ['is_verified', 'verified', 'isVerified', 'email_verified']),
    raw: source,
  };

  // A body with none of the identifying fields isn't a user object.
  return user.id || user.email || user.fullName ? user : null;
}

function readBoolean(source: Json, keys: string[]): boolean | null {
  for (const key of keys) {
    if (typeof source[key] === 'boolean') return source[key] as boolean;
  }
  return null;
}
