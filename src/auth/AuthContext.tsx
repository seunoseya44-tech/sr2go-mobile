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
import { packStore } from '../boarding/store';
import { parseUser } from '../api/parsers';
import type { AuthTokens, LoginCredentials, RegisterPayload, User } from '../api/types';
import { secureStorage } from '../storage/secureStorage';
import { decodeJwt, isExpired } from './jwt';
import { session } from './session';
import { clearSelfie } from '../kyc/selfieStore';

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
  /** True once the user has confirmed their phone with the OTP. */
  phoneVerified: boolean;
  signIn(credentials: LoginCredentials): Promise<void>;
  /** Registers, stores the tokens and leaves the user on the OTP step. */
  register(payload: RegisterPayload): Promise<void>;
  /** After a successful OTP: marks the phone verified and refreshes the profile. */
  markPhoneVerified(): Promise<void>;
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
    await Promise.all([
      session.clear(),
      secureStorage.remove(USER_CACHE_KEY),
      packStore.wipe().catch(() => undefined),
      clearSelfie(),
    ]);
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
          if (!cancelled) await endSession('Your session has expired. Please log in again.');
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
        dispatch({ type: 'SIGNED_OUT', notice: 'Your session has expired. Please log in again.' });
      }),
    [],
  );

  const settle = useCallback(async (tokens: AuthTokens, fromLogin: User | null) => {
    await session.save(tokens);
    // Prefer the full profile from /me; fall back to what login returned,
    // then to the token's own claims. A failing /me must not block sign-in.
    const profile = await authApi.me({ silent: true }).catch(() => null);
    // Keep login's phone_verified when /me doesn't carry it.
    const user =
      profile && fromLogin && profile.phoneVerified == null
        ? { ...profile, phoneVerified: fromLogin.phoneVerified }
        : (profile ?? fromLogin ?? userFromToken(tokens.accessToken));
    await cacheUser(user);
    dispatch({ type: 'SIGNED_IN', tokens: session.getTokens() ?? tokens, user });
  }, []);

  const signIn = useCallback(
    async (credentials: LoginCredentials) => {
      const { tokens, user } = await authApi.login(credentials);
      await settle(tokens, user);
    },
    [settle],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const { tokens, user } = await authApi.register(payload);
      // Registration always lands on the OTP step.
      const unverified = user ? { ...user, phoneVerified: false } : user;
      await settle(tokens, unverified);
      if (payload.referralCode) {
        const id = session.getTokens() ? (user?.id ?? userFromToken(tokens.accessToken)?.id) : null;
        if (id) {
          // Linking the referral must never block sign-up.
          await authApi.processReferralSignup(id, payload.referralCode).catch(() => undefined);
        }
      }
    },
    [settle],
  );

  const markPhoneVerified = useCallback(async () => {
    const profile = await authApi.me({ silent: true }).catch(() => null);
    const user = { ...(profile ?? state.user ?? ({} as User)), phoneVerified: true } as User;
    await cacheUser(user);
    dispatch({ type: 'USER_UPDATED', user, tokens: session.getTokens() });
  }, [state.user]);

  const signOut = useCallback(() => endSession(), [endSession]);

  const refreshProfile = useCallback(async () => {
    const user = await authApi.me();
    await cacheUser(user);
    dispatch({ type: 'USER_UPDATED', user, tokens: session.getTokens() });
  }, []);

  const clearNotice = useCallback(() => dispatch({ type: 'NOTICE_CLEARED' }), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      // Unknown (null) counts as verified so an older backend response never
      // traps users on the OTP screen; the API still enforces ERR_014.
      phoneVerified: state.user?.phoneVerified !== false,
      signIn,
      register,
      markPhoneVerified,
      signOut,
      refreshProfile,
      clearNotice,
    }),
    [state, signIn, register, markPhoneVerified, signOut, refreshProfile, clearNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
