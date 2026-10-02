import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';

import { stripErrorCode, toApiError } from '../api/errors';

function httpError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response = { status, data, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, {}, response);
}

describe('backend error shapes (Design Review 3 / 2 Oct update)', () => {
  it('reads the login object detail with attempts_left', () => {
    const e = toApiError(
      httpError(401, {
        detail: {
          error: 'invalid_credentials',
          attempts_left: 2,
          message: 'Wrong email or password. 2 tries left.',
        },
      }),
    );
    expect(e.kind).toBe('unauthorized');
    expect(e.code).toBe('invalid_credentials');
    expect(e.extra.attemptsLeft).toBe(2);
    expect(e.message).toBe('Wrong email or password. 2 tries left.');
  });

  it('reads the locked login with retry_after_minutes', () => {
    const e = toApiError(
      httpError(429, {
        detail: {
          error: 'login_locked',
          retry_after_minutes: 15,
          message: 'Locked for 15 minutes.',
        },
      }),
    );
    expect(e.kind).toBe('rateLimited');
    expect(e.code).toBe('login_locked');
    expect(e.extra.retryAfterMinutes).toBe(15);
    expect(e.message).toBe('Locked for 15 minutes.');
  });

  it('reads kyc_required flags on a 403', () => {
    const e = toApiError(
      httpError(403, {
        detail: {
          error: 'kyc_required',
          has_selfie: true,
          nin_verified: false,
          bank_verified: false,
          bank_required: false,
        },
      }),
    );
    expect(e.kind).toBe('forbidden');
    expect(e.code).toBe('kyc_required');
    expect(e.extra).toMatchObject({ hasSelfie: true, ninVerified: false, bankRequired: false });
  });

  it('reads already_paid with its reference on a 409', () => {
    const e = toApiError(
      httpError(409, {
        detail: { error: 'already_paid', message: 'Already paid.', reference: 'SR2G-1' },
      }),
    );
    expect(e.kind).toBe('conflict');
    expect(e.extra.reference).toBe('SR2G-1');
  });

  it('strips ERR_0xx prefixes and never shows raw codes', () => {
    expect(stripErrorCode('ERR_013 — Wrong email or password')).toBe('Wrong email or password');
    const e = toApiError(httpError(400, { detail: 'ERR_012 - Code expired' }));
    expect(e.message).toBe('Code expired');
  });

  it('shows a worded 503 but hides HTML 500s', () => {
    expect(
      toApiError(httpError(503, { detail: 'We could not check your earlier payment. Try again.' }))
        .message,
    ).toContain('earlier payment');
    expect(toApiError(httpError(500, '<html>Traceback</html>')).message).not.toContain('Traceback');
  });

  it('maps 410 to gone', () => {
    expect(toApiError(httpError(410, { detail: 'Removed' })).kind).toBe('gone');
  });
});
