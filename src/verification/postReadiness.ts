/**
 * Field test 8 Nov 2026 (Seun's phone): a driver filled in Route, Price and Details, tapped Post, and only then read
 * "Verification incomplete ... bank account". Post a ride now asks the server (GET /api/kyc/status, fresh - the bank
 * can be cleared after sign-in, release 133) on its FIRST step and says at once what is missing, with the button
 * that fixes it.
 */
import { ENDPOINTS, http } from '../api/client';

export type Missing = 'identity' | 'bank' | null;

export interface PostReadiness {
  missing: Missing;
  message: string | null;
}

export function postReadiness(status: unknown): PostReadiness {
  const s = (status ?? {}) as Record<string, unknown>;
  if (s.identity_verified === false)
    return {
      missing: 'identity',
      message: 'Verify your identity (NIN or BVN with a live selfie) before you post a ride.',
    };
  if (s.bank_required === true && s.bank_verified !== true)
    return {
      missing: 'bank',
      message:
        'Add your bank account before you post a ride. SR2Go pays your earnings into it after each trip.',
    };
  return { missing: null, message: null };
}

export async function loadPostReadiness(): Promise<PostReadiness> {
  const { data } = await http.get(ENDPOINTS.kycStatus);
  return postReadiness(data);
}
