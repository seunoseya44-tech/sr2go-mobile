import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';

import { ApiError, toApiError } from '../api/errors';

function httpError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response = { status, data, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, {}, response);
}

describe('toApiError', () => {
  it('maps a 401 with a FastAPI detail string', () => {
    const error = toApiError(httpError(401, { detail: 'Invalid credentials' }));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe('unauthorized');
    expect(error.message).toBe('Invalid credentials');
  });

  it('maps a 422 validation list to field errors', () => {
    const error = toApiError(
      httpError(422, {
        detail: [
          { type: 'missing', loc: ['body', 'email'], msg: 'Field required' },
          { type: 'missing', loc: ['body', 'password'], msg: 'Field required' },
        ],
      }),
    );
    expect(error.kind).toBe('validation');
    expect(error.fieldErrors).toEqual({ email: 'Field required', password: 'Field required' });
  });

  it('hides raw server error bodies behind a friendly message', () => {
    const error = toApiError(httpError(500, '<html>Traceback ...</html>'));
    expect(error.kind).toBe('server');
    expect(error.message).not.toContain('Traceback');
  });

  it('detects network failures and timeouts', () => {
    expect(toApiError(new AxiosError('Network Error', 'ERR_NETWORK')).kind).toBe('network');
    expect(toApiError(new AxiosError('timeout', 'ECONNABORTED')).kind).toBe('timeout');
  });

  it('maps rate limiting', () => {
    expect(toApiError(httpError(429, {})).kind).toBe('rateLimited');
  });

  it('wraps unknown values', () => {
    expect(toApiError(new Error('boom')).kind).toBe('unknown');
  });
});
