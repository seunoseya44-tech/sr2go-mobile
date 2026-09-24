import axios, {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

jest.mock('../storage/secureStorage', () => {
  const store = new Map<string, string>();
  return {
    secureStorage: {
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      set: jest.fn(async (key: string, value: string) => void store.set(key, value)),
      remove: jest.fn(async (key: string) => void store.delete(key)),
    },
  };
});

type Handler = (config: InternalAxiosRequestConfig) => [number, unknown];

let handler: Handler;
const calls: { url?: string; auth?: string }[] = [];

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  const response: AxiosResponse = { status, data, statusText: '', headers: {}, config };
  if (status >= 200 && status < 300) return Promise.resolve(response);
  return Promise.reject(
    new AxiosError(`HTTP ${status}`, 'ERR_BAD_REQUEST', config, null, response),
  );
}

const adapter: AxiosAdapter = (config) => {
  calls.push({ url: config.url, auth: config.headers.get('Authorization') as string | undefined });
  const [status, data] = handler(config);
  return respond(config, status, data);
};

// Both axios instances in the client copy defaults at creation time, so the
// mock adapter must be installed before the module is loaded.
axios.defaults.adapter = adapter;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { http, ENDPOINTS } = require('../api/client') as typeof import('../api/client');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { session } = require('../auth/session') as typeof import('../auth/session');

beforeEach(async () => {
  calls.length = 0;
  await session.save({ accessToken: 'old-access', refreshToken: 'refresh-1', tokenType: 'bearer' });
});

describe('http client', () => {
  it('attaches the bearer token to authenticated requests', async () => {
    handler = () => [200, { email: 'a@b.co' }];
    await http.get(ENDPOINTS.me);
    expect(calls[0]?.auth).toBe('Bearer old-access');
  });

  it('never sends a bearer token to the login endpoint', async () => {
    handler = () => [200, { access_token: 'x' }];
    await http.post(ENDPOINTS.login, { email: 'a@b.co', password: 'p' });
    expect(calls[0]?.auth).toBeUndefined();
  });

  it('refreshes once on 401 and retries the original request', async () => {
    handler = (config) => {
      if (config.url === ENDPOINTS.refresh) return [200, { access_token: 'new-access' }];
      const auth = config.headers.get('Authorization');
      return auth === 'Bearer new-access' ? [200, { ok: true }] : [401, { detail: 'expired' }];
    };

    const { data } = await http.get(ENDPOINTS.me);

    expect(data).toEqual({ ok: true });
    expect(session.getTokens()).toEqual({
      accessToken: 'new-access',
      refreshToken: 'refresh-1', // kept because the server didn't rotate it
      tokenType: 'bearer',
    });
  });

  it('shares a single refresh between concurrent 401s', async () => {
    handler = (config) => {
      if (config.url === ENDPOINTS.refresh) {
        return [200, { access_token: 'new-access', refresh_token: 'refresh-2' }];
      }
      const auth = config.headers.get('Authorization');
      return auth === 'Bearer new-access' ? [200, {}] : [401, {}];
    };

    await Promise.all([http.get(ENDPOINTS.me), http.get(ENDPOINTS.me), http.get(ENDPOINTS.me)]);

    expect(calls.filter((c) => c.url === ENDPOINTS.refresh)).toHaveLength(1);
  });

  it('ends the session when the refresh token is rejected', async () => {
    const onExpired = jest.fn();
    const unsubscribe = session.onExpired(onExpired);
    handler = () => [401, { detail: 'Invalid or expired token' }];

    await expect(http.get(ENDPOINTS.me)).rejects.toMatchObject({ kind: 'unauthorized' });

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(session.getTokens()).toBeNull();
    unsubscribe();
  });

  it('leaves the session alone for requests that opt out', async () => {
    const onExpired = jest.fn();
    const unsubscribe = session.onExpired(onExpired);
    handler = () => [401, {}];

    await expect(http.get(ENDPOINTS.me, { skipSessionHandling: true })).rejects.toBeDefined();

    expect(onExpired).not.toHaveBeenCalled();
    expect(calls.some((c) => c.url === ENDPOINTS.refresh)).toBe(false);
    expect(session.getTokens()?.accessToken).toBe('old-access');
    unsubscribe();
  });

  it('turns failures into ApiErrors', async () => {
    handler = () => [503, 'upstream down'];
    await expect(http.get('/api/anything')).rejects.toMatchObject({ kind: 'server' });
  });
});
