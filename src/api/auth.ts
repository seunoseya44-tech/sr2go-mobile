import { ENDPOINTS, http } from './client';
import { parseTokens, parseUser } from './parsers';
import type { LoginCredentials, LoginResult, RegisterPayload, User } from './types';

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
   * POST /api/auth/register. Returns tokens like login; the caller stores
   * them and goes straight to phone verification.
   */
  async register(payload: RegisterPayload): Promise<LoginResult> {
    const { data } = await http.post(ENDPOINTS.register, {
      full_name: payload.fullName.trim(),
      email: payload.email.trim(),
      phone: payload.phone,
      password: payload.password,
      role: payload.role,
    });
    return { tokens: parseTokens(data), user: parseUser(data) };
  },

  /** POST /api/auth/verify-phone (auth) with the 6-digit code. */
  async verifyPhone(code: string): Promise<void> {
    await http.post(ENDPOINTS.verifyPhone, { code }, { skipSessionHandling: true });
  },

  /** POST /api/auth/resend-otp (auth). */
  async resendOtp(): Promise<void> {
    await http.post(ENDPOINTS.resendOtp, {}, { skipSessionHandling: true });
  },

  /**
   * POST /api/users/password-reset/request {email}. Always returns 200,
   * whether or not the email exists; the screen shows the same neutral text.
   */
  async requestPasswordReset(email: string): Promise<void> {
    await http.post(ENDPOINTS.passwordResetRequest, { email: email.trim() });
  },

  /** POST /api/users/password-reset/confirm {token, new_password}. */
  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    await http.post(ENDPOINTS.passwordResetConfirm, { token, new_password: newPassword });
  },

  /** POST /api/referral/validate-code. Any format; the backend detects the type. */
  async validateReferral(referralCode: string): Promise<boolean> {
    const { data } = await http.post(ENDPOINTS.referralValidate, {
      referral_code: referralCode.trim(),
    });
    const body = data as { valid?: unknown; is_valid?: unknown } | undefined;
    return body?.valid !== false && body?.is_valid !== false;
  },

  /**
   * POST /api/referral/process-signup (auth since 2 Oct: the new user's own
   * token). Within 7 days of sign-up only.
   */
  async processReferralSignup(newUserId: string, referralCode: string): Promise<void> {
    await http.post(ENDPOINTS.referralProcessSignup, {
      new_user_id: newUserId,
      referral_code: referralCode.trim(),
    });
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
