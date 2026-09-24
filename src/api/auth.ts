import { ENDPOINTS, http } from './client';
import { parseTokens, parseUser } from './parsers';
import type { LoginCredentials, LoginResult, User } from './types';

export const authApi = {
  /** POST /api/auth/login. Throws `ApiError` on failure. */
  async login({ email, password }: LoginCredentials): Promise<LoginResult> {
    const { data } = await http.post(ENDPOINTS.login, {
      email: email.trim(),
      password,
    });
    return { tokens: parseTokens(data), user: parseUser(data) };
  },

  /**
   * GET /api/auth/me. Needs a valid access token in the session.
   * `silent` lets a 401 fail quietly instead of ending the session.
   */
  async me({ silent = false }: { silent?: boolean } = {}): Promise<User | null> {
    const { data } = await http.get(ENDPOINTS.me, { skipSessionHandling: silent });
    return parseUser(data);
  },
};
