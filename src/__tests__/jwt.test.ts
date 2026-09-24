import { decodeJwt, getExpiry, isExpired } from '../auth/jwt';
import { makeJwt, nowInSeconds } from './helpers';

describe('jwt helpers', () => {
  it('decodes claims', () => {
    expect(decodeJwt(makeJwt({ sub: '42', email: 'a@b.co' }))).toMatchObject({ sub: '42' });
  });

  it('returns null for malformed tokens', () => {
    expect(decodeJwt('not-a-jwt')).toBeNull();
    expect(getExpiry('not-a-jwt')).toBeNull();
  });

  it('treats tokens inside the skew window as expired', () => {
    expect(isExpired(makeJwt({ exp: nowInSeconds() + 3600 }))).toBe(false);
    expect(isExpired(makeJwt({ exp: nowInSeconds() + 10 }))).toBe(true);
    expect(isExpired(makeJwt({ exp: nowInSeconds() - 10 }))).toBe(true);
  });

  it('treats tokens without exp as valid (the server decides)', () => {
    expect(isExpired(makeJwt({ sub: '1' }))).toBe(false);
  });
});
