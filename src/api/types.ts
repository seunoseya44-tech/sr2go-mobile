export interface AuthTokens {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
}

/**
 * The subset of the user profile the app relies on. The backend may return
 * more fields; unknown ones are kept in `raw` so nothing is lost.
 */
export interface User {
  id: string | null;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  role: string | null;
  isVerified: boolean | null;
  raw: Record<string, unknown>;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResult {
  tokens: AuthTokens;
  user: User | null;
}
