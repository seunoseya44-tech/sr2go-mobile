import type { AuthTokens } from '../api/types';
import { secureStorage } from '../storage/secureStorage';

/**
 * Framework-agnostic session holder. The HTTP client reads tokens from here
 * synchronously (no keystore round-trip per request), and the React layer
 * subscribes to learn when the session ends from outside the UI, e.g. a
 * refresh token being rejected mid-request.
 */

const STORAGE_KEY = 'sr2go.auth.session.v1';

type ExpiredListener = () => void;

let current: AuthTokens | null = null;
const expiredListeners = new Set<ExpiredListener>();

function isTokens(value: unknown): value is AuthTokens {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as AuthTokens).accessToken === 'string' &&
    (value as AuthTokens).accessToken.length > 0
  );
}

export const session = {
  getTokens(): AuthTokens | null {
    return current;
  },

  async load(): Promise<AuthTokens | null> {
    const stored = await secureStorage.get(STORAGE_KEY);
    if (!stored) return (current = null);
    try {
      const parsed: unknown = JSON.parse(stored);
      current = isTokens(parsed) ? parsed : null;
    } catch {
      current = null;
    }
    if (!current) await secureStorage.remove(STORAGE_KEY);
    return current;
  },

  async save(tokens: AuthTokens): Promise<void> {
    current = tokens;
    await secureStorage.set(STORAGE_KEY, JSON.stringify(tokens));
  },

  async clear(): Promise<void> {
    current = null;
    await secureStorage.remove(STORAGE_KEY);
  },

  /** Called by the HTTP layer when the session can't be recovered. */
  async expire(): Promise<void> {
    await session.clear();
    expiredListeners.forEach((listener) => listener());
  },

  onExpired(listener: ExpiredListener): () => void {
    expiredListeners.add(listener);
    return () => {
      expiredListeners.delete(listener);
    };
  },
};
