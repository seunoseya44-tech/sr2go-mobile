import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type PropsWithChildren,
} from 'react';

import { authApi } from '../api/auth';
import { refreshTokens } from '../api/client';
import { parseUser } from '../api/parsers';
import type { AuthTokens, LoginCredentials, User } from '../api/types';
import { secureStorage } from '../storage/secureStorage';
import { decodeJwt, isExpired } from './jwt';
import { session } from './session';

const USER_CACHE_KEY = 'sr2go.auth.user.v1';

type Status = 'restoring' | 'signedOut' | 'signedIn';

interface State {
  status: Status;
  user: User | null;
  tokens: AuthTokens | null;
  /** One-off message for the login screen, e.g. "session expired". */
  notice: string | null;
}

type Action =
  | { type: 'SIGNED_IN'; tokens: AuthTokens; user: User | null }
  | { type: 'SIGNED_OUT'; notice?: string }
  | { type: 'USER_UPDATED'; user: User | null; tokens?: AuthTokens | null }
  | { type: 'NOTICE_CLEARED' };

const initialState: State = { status: 'restoring', user: null, tokens: null, notice: null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SIGNED_IN':
      return { status: 'signedIn', tokens: action.tokens, user: action.user, notice: null };
    case 'SIGNED_OUT':
      return { status: 'signedOut', tokens: null, user: null, notice: action.notice ?? null };
    case 'USER_UPDATED':
      return { ...state, user: action.user ?? state.user, tokens: action.tokens ?? state.tokens };
    case 'NOTICE_CLEARED':
      return { ...state, notice: null };
  }
}

export interface AuthContextValue extends State {
  signIn(credentials: LoginCredentials): Promise<void>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
  clearNotice(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Last-resort profile built from JWT claims when the API returns no user. */
function userFromToken(token: string): User | null {
  const claims = decodeJwt(token);
  if (!claims) return null;
  const email =
    typeof claims.email === 'string' ? claims.email : claims.sub?.includes('@') ? claims.sub : null;
  return parseUser({ ...claims, id: claims.sub, email });
}

async function readCachedUser(): Promise<User | null> {
  const raw = await secureStorage.get(USER_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

async function cacheUser(user: User | null): Promise<void> {
  if (user) await secureStorage.set(USER_CACHE_KEY, JSON.stringify(user));
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const endSession = useCallback(async (notice?: string) => {
    await Promise.all([session.clear(), secureStorage.remove(USER_CACHE_KEY)]);
    dispatch({ type: 'SIGNED_OUT', notice });
  }, []);

  // Restore a persisted session on launch.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let tokens = await session.load();
      if (!tokens) {
        if (!cancelled) dispatch({ type: 'SIGNED_OUT' });
        return;
      }

      if (isExpired(tokens.accessToken)) {
        try {
          tokens = await refreshTokens();
        } catch {
          if (!cancelled) await endSession('Your session has expired. Please sign in again.');
          return;
        }
      }

      const cached = (await readCachedUser()) ?? userFromToken(tokens.accessToken);
      if (cancelled) return;
      // Show the home screen straight away with cached data (works offline),
      // then refresh the profile in the background.
      dispatch({ type: 'SIGNED_IN', tokens, user: cached });

      authApi
        .me()
        .then(async (user) => {
          if (!user || cancelled) return;
          await cacheUser(user);
          dispatch({ type: 'USER_UPDATED', user, tokens: session.getTokens() });
        })
        .catch(() => {
          // Offline or transient errors keep the cached profile. A real 401 is
          // handled by the HTTP layer via `session.onExpired`.
        });
    })();

    return () => {
      cancelled = true;
    };
  }, [endSession]);

  // The HTTP layer ends the session when a refresh fails mid-request.
  useEffect(
    () =>
      session.onExpired(() => {
        void secureStorage.remove(USER_CACHE_KEY);
        dispatch({ type: 'SIGNED_OUT', notice: 'Your session has expired. Please sign in again.' });
      }),
    [],
  );

  const signIn = useCallback(async (credentials: LoginCredentials) => {
    const { tokens, user: loginUser } = await authApi.login(credentials);
    await session.save(tokens);

    // Prefer the full profile from /me; fall back to what login returned,
    // then to the token's own claims. A failing /me must not block sign-in.
    const profile = await authApi.me({ silent: true }).catch(() => null);
    const user = profile ?? loginUser ?? userFromToken(tokens.accessToken);
    await cacheUser(user);

    dispatch({ type: 'SIGNED_IN', tokens: session.getTokens() ?? tokens, user });
  }, []);

  const signOut = useCallback(() => endSession(), [endSession]);

  const refreshProfile = useCallback(async () => {
    const user = await authApi.me();
    await cacheUser(user);
    dispatch({ type: 'USER_UPDATED', user, tokens: session.getTokens() });
  }, []);

  const clearNotice = useCallback(() => dispatch({ type: 'NOTICE_CLEARED' }), []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signOut, refreshProfile, clearNotice }),
    [state, signIn, signOut, refreshProfile, clearNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
