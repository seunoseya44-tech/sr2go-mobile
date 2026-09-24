import { ApiError } from '../api/errors';
import { parseTokens, parseUser } from '../api/parsers';

describe('parseTokens', () => {
  it('reads the FastAPI OAuth2 shape', () => {
    expect(parseTokens({ access_token: 'a', refresh_token: 'r', token_type: 'bearer' })).toEqual({
      accessToken: 'a',
      refreshToken: 'r',
      tokenType: 'bearer',
    });
  });

  it('accepts camelCase and `token` naming', () => {
    expect(parseTokens({ accessToken: 'a', refreshToken: 'r' }).accessToken).toBe('a');
    expect(parseTokens({ token: 't' })).toEqual({
      accessToken: 't',
      refreshToken: null,
      tokenType: 'bearer',
    });
  });

  it('unwraps a `{ data: ... }` envelope', () => {
    expect(parseTokens({ success: true, data: { access_token: 'a' } }).accessToken).toBe('a');
  });

  it('throws an ApiError when no token is present', () => {
    expect(() => parseTokens({ message: 'ok' })).toThrow(ApiError);
    expect(() => parseTokens(null)).toThrow(ApiError);
  });
});

describe('parseUser', () => {
  it('reads a nested user object', () => {
    const user = parseUser({
      access_token: 'a',
      user: {
        id: 7,
        email: 'ada@example.com',
        full_name: 'Ada Obi',
        role: 'passenger',
        is_verified: true,
      },
    });
    expect(user).toMatchObject({
      id: '7',
      email: 'ada@example.com',
      fullName: 'Ada Obi',
      role: 'passenger',
      isVerified: true,
    });
  });

  it('joins first and last name when there is no full name', () => {
    expect(parseUser({ email: 'x@y.co', first_name: 'Ada', last_name: 'Obi' })?.fullName).toBe(
      'Ada Obi',
    );
  });

  it('returns null for a body without identifying fields', () => {
    expect(parseUser({ access_token: 'a', token_type: 'bearer' })).toBeNull();
  });
});
