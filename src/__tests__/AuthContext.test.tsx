import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { ApiError } from '../api/errors';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { session } from '../auth/session';
import { makeJwt, nowInSeconds } from './helpers';

jest.mock('../storage/secureStorage', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    secureStorage: {
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      set: jest.fn(async (key: string, value: string) => void store.set(key, value)),
      remove: jest.fn(async (key: string) => void store.delete(key)),
    },
  };
});

const mockLogin = jest.fn();
const mockMe = jest.fn();
const mockRefresh = jest.fn();

jest.mock('../api/auth', () => ({
  authApi: {
    login: (...args: unknown[]) => mockLogin(...args),
    me: (...args: unknown[]) => mockMe(...args),
  },
}));
jest.mock('../api/client', () => ({ refreshTokens: () => mockRefresh() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const store: Map<string, string> = require('../storage/secureStorage').__store;

const wrapper = ({ children }: PropsWithChildren) => <AuthProvider>{children}</AuthProvider>;
const validToken = () => makeJwt({ sub: '1', email: 'jwt@sr2go.com', exp: nowInSeconds() + 3600 });
const expiredToken = () => makeJwt({ sub: '1', exp: nowInSeconds() - 60 });

const profile = {
  id: '1',
  email: 'seun@example.com',
  fullName: 'Seun Adeyemi',
  phone: null,
  role: 'passenger',
  isVerified: true,
  raw: {},
};

beforeEach(async () => {
  store.clear();
  await session.clear();
  mockLogin.mockReset();
  mockMe.mockReset();
  mockRefresh.mockReset();
});

describe('AuthProvider', () => {
  it('starts signed out when nothing is stored', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
  });

  it('signs in, persists tokens and loads the profile', async () => {
    const tokens = { accessToken: validToken(), refreshToken: 'r', tokenType: 'bearer' };
    mockLogin.mockResolvedValue({ tokens, user: null });
    mockMe.mockResolvedValue(profile);

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(() => result.current.signIn({ email: 'seun@example.com', password: 'pw' }));

    expect(result.current.status).toBe('signedIn');
    expect(result.current.user?.fullName).toBe('Seun Adeyemi');
    expect(session.getTokens()?.accessToken).toBe(tokens.accessToken);
    expect([...store.values()].some((v) => v.includes(tokens.accessToken))).toBe(true);
  });

  it('falls back to JWT claims when /me fails after login', async () => {
    mockLogin.mockResolvedValue({
      tokens: { accessToken: validToken(), refreshToken: null, tokenType: 'bearer' },
      user: null,
    });
    mockMe.mockRejectedValue(new ApiError('server', 'down', 500));

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    await act(() => result.current.signIn({ email: 'a@b.co', password: 'pw' }));

    expect(result.current.status).toBe('signedIn');
    expect(result.current.user?.email).toBe('jwt@sr2go.com');
  });

  it('stays signed out and rethrows when login fails', async () => {
    mockLogin.mockRejectedValue(new ApiError('unauthorized', 'Invalid credentials', 401));

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await expect(
      act(() => result.current.signIn({ email: 'a@b.co', password: 'bad' })),
    ).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(result.current.status).toBe('signedOut');
    expect(session.getTokens()).toBeNull();
  });

  it('restores a stored session on launch', async () => {
    await session.save({ accessToken: validToken(), refreshToken: 'r', tokenType: 'bearer' });
    mockMe.mockResolvedValue(profile);

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    await waitFor(() => expect(result.current.user?.fullName).toBe('Seun Adeyemi'));
  });

  it('refreshes an expired token on launch', async () => {
    await session.save({ accessToken: expiredToken(), refreshToken: 'r', tokenType: 'bearer' });
    const fresh = { accessToken: validToken(), refreshToken: 'r2', tokenType: 'bearer' };
    // Like the real refreshTokens(), persist the new pair before resolving.
    mockRefresh.mockImplementation(async () => {
      await session.save(fresh);
      return fresh;
    });
    mockMe.mockResolvedValue(profile);

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.tokens?.accessToken).toBe(fresh.accessToken);
  });

  it('signs out with a notice when the expired session cannot be refreshed', async () => {
    await session.save({ accessToken: expiredToken(), refreshToken: 'r', tokenType: 'bearer' });
    mockRefresh.mockRejectedValue(new Error('refresh rejected'));

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.notice).toMatch(/expired/);
    expect(store.size).toBe(0);
  });

  it('reacts to the HTTP layer expiring the session', async () => {
    await session.save({ accessToken: validToken(), refreshToken: 'r', tokenType: 'bearer' });
    mockMe.mockResolvedValue(profile);

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    await act(() => session.expire());

    expect(result.current.status).toBe('signedOut');
    expect(result.current.notice).toMatch(/expired/);
  });

  it('clears everything on sign out', async () => {
    await session.save({ accessToken: validToken(), refreshToken: 'r', tokenType: 'bearer' });
    mockMe.mockResolvedValue(profile);

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    await act(() => result.current.signOut());

    expect(result.current.status).toBe('signedOut');
    expect(result.current.notice).toBeNull();
    expect(store.size).toBe(0);
  });
});
