/**
 * Identity check (KYC), profile, wallet, referral and account deletion
 * (Build Brief §B/K, 13 and 15 Oct updates). The ID number is sent once and
 * never stored or logged on the device.
 */
import { ENDPOINTS, http } from './client';
import { parseUser, unwrap, unwrapList } from './parsers';
import type { User } from './types';

type Json = Record<string, unknown>;
const obj = (v: unknown): Json =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {};
const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null;
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const first = (s: Json, keys: string[]) => {
  for (const k of keys) {
    const v = str(s[k]);
    if (v) return v;
  }
  return null;
};

/* ---------- KYC ---------- */

export interface ConsentConfig {
  enabled: boolean;
  text: string | null;
  version: string | null;
  regulatoryBody: string | null;
  consentType: string;
}

export interface KycResult {
  verified: boolean;
  message: string | null;
}

export interface Bank {
  name: string;
  code: string;
}

export const kycApi = {
  async consentConfig(): Promise<ConsentConfig> {
    const { data } = await http.get(ENDPOINTS.selfieConsentConfig, { skipSessionHandling: true });
    const s = unwrap(data);
    return {
      enabled:
        s.enabled !== false && s.feature_enabled !== false && s.selfie_consent_required !== false,
      text: first(s, ['disclaimer_text', 'disclaimer', 'text']),
      version: first(s, ['disclaimer_version', 'version']),
      regulatoryBody: first(s, ['regulatory_body']),
      consentType: first(s, ['consent_type']) ?? 'selfie_verification',
    };
  },

  async giveConsent(c: ConsentConfig, deviceId: string): Promise<void> {
    await http.post(ENDPOINTS.selfieConsent, {
      consent_type: c.consentType,
      disclaimer_version: c.version,
      regulatory_body: c.regulatoryBody,
      session_id: deviceId,
      device_id: deviceId,
    });
  },

  /** POST /api/auth/kyc/dojah. 503 selfie_not_stored, 429, 403 kyc_under_review / under 18. */
  async verify(p: {
    type: 'nin' | 'bvn';
    idNumber: string;
    dateOfBirth: string;
    selfieBase64: string;
  }): Promise<KycResult> {
    const { data } = await http.post(ENDPOINTS.kycDojah, {
      verification_type: p.type,
      id_number: p.idNumber,
      date_of_birth: p.dateOfBirth,
      selfie_image: p.selfieBase64,
    });
    const s = unwrap(data);
    return {
      verified:
        s.verified === true ||
        s.identity_verified === true ||
        s.success === true ||
        s.status === 'verified',
      message: first(s, ['message']),
    };
  },

  async banks(): Promise<Bank[]> {
    const { data } = await http.get(ENDPOINTS.kycBanks);
    return unwrapList(data, ['banks', 'items', 'results'])
      .map((v) => {
        const b = obj(v);
        const name = first(b, ['name', 'bank_name']);
        const code = first(b, ['code', 'bank_code']);
        return name && code ? { name, code } : null;
      })
      .filter((b): b is Bank => !!b);
  },

  async resolveAccount(bankCode: string, accountNumber: string): Promise<string | null> {
    const { data } = await http.get(ENDPOINTS.kycBanksResolve, {
      params: { bank_code: bankCode, account_number: accountNumber },
    });
    return first(unwrap(data), ['account_name', 'name']);
  },

  async registerBank(b: {
    bankName: string;
    bankCode: string;
    accountNumber: string;
  }): Promise<void> {
    await http.post(ENDPOINTS.kycBankRegister, {
      bank_name: b.bankName,
      bank_code: b.bankCode,
      account_number: b.accountNumber,
    });
  },
};

/* ---------- profile ---------- */

export const profileApi = {
  async update(p: { fullName?: string; phone?: string }): Promise<User | null> {
    const { data } = await http.put(ENDPOINTS.usersMe, {
      ...(p.fullName != null ? { full_name: p.fullName } : {}),
      ...(p.phone != null ? { phone: p.phone } : {}),
    });
    return parseUser(data);
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await http.put(ENDPOINTS.usersMePassword, {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },

  /** Endpoint still to be confirmed by SR2Go; the backend message is shown as given. */
  async deleteAccount(): Promise<string | null> {
    const { data } = await http.delete(ENDPOINTS.usersMe);
    return first(unwrap(data), ['message']);
  },
};

/* ---------- wallet and referral ---------- */

export interface WalletActivity {
  id: string;
  description: string;
  date: string | null;
  amount: string | null;
  type: string | null;
}

export interface Wallet {
  balance: string | null;
  activity: WalletActivity[];
  expiryNote: string | null;
}

export function parseWallet(payload: unknown): Wallet {
  const s = unwrap(payload);
  const list = unwrapList(s.transactions ?? s.activity ?? s.history ?? [], ['items', 'results']);
  return {
    balance: first(s, [
      'balance',
      'available_credits',
      'credits',
      'wallet_balance',
      'ride_credits',
    ]),
    expiryNote: first(s, ['expiry_note', 'note']),
    activity: list
      .map((v, i) => {
        const t = obj(v);
        const amount = first(t, ['amount', 'credits']);
        return {
          id: first(t, ['id', 'transaction_id']) ?? String(i),
          description: first(t, ['description', 'title', 'reason', 'type']) ?? 'Ride credit',
          date: first(t, ['created_at', 'date']),
          amount,
          type: first(t, ['type', 'transaction_type']),
        };
      })
      .filter((a) => !!a.amount),
  };
}

export interface ReferralDashboard {
  code: string | null;
  friendsJoined: number | null;
  travelled: number | null;
  creditsEarned: string | null;
  milestone: string | null;
  shareMessage: string | null;
}

export interface GiftRecipient {
  name: string | null;
  phoneMasked: string | null;
  verified: boolean;
}

export interface TopUpAccount {
  accountNumber: string | null;
  bankName: string | null;
  accountName: string | null;
}

export const walletApi = {
  async wallet(): Promise<Wallet> {
    const { data } = await http.get(ENDPOINTS.referralWallet);
    return parseWallet(data);
  },

  async dashboard(): Promise<ReferralDashboard> {
    const { data } = await http.get(ENDPOINTS.referralDashboard);
    const s = unwrap(data);
    const stats = obj(s.stats);
    const m = obj(s.next_milestone ?? s.milestone);
    return {
      code: first(s, ['referral_code', 'code']),
      friendsJoined: num(s.friends_joined ?? s.total_referrals ?? stats.referrals ?? stats.signups),
      travelled: num(s.friends_travelled ?? s.travelled ?? stats.travelled ?? stats.completed),
      creditsEarned:
        first(s, ['credits_earned', 'total_earned', 'earned']) ??
        first(stats, ['earned', 'credits']),
      milestone: first(m, ['text', 'description', 'label']) ?? first(s, ['milestone_text']),
      shareMessage: first(s, ['share_message']),
    };
  },

  async generateCode(): Promise<string | null> {
    const { data } = await http.post(ENDPOINTS.referralGenerateCode, {});
    return first(unwrap(data), ['referral_code', 'code']);
  },

  /** 15 Oct: look-up by phone only; no avatar. */
  async giftLookup(phone: string): Promise<GiftRecipient> {
    const { data } = await http.post(ENDPOINTS.walletGiftLookup, { phone });
    const s = unwrap(data);
    return {
      name: first(s, ['name', 'short_name']),
      phoneMasked: first(s, ['phone_masked', 'phone']),
      verified: s.verified === true,
    };
  },

  /** 422 recipient_not_verified / invalid_amount / insufficient_balance: show the message. */
  async gift(phone: string, amount: string): Promise<string | null> {
    const { data } = await http.post(ENDPOINTS.walletGift, { phone, amount: Number(amount) });
    return first(unwrap(data), ['message']);
  },

  /** Top-up endpoints are SR2Go's to confirm; 404s surface as the backend message. */
  async topUpAccount(): Promise<TopUpAccount> {
    const { data } = await http.get(ENDPOINTS.walletTopUpAccount);
    const s = unwrap(data);
    const a = obj(s.account);
    return {
      accountNumber: first(s, ['account_number']) ?? first(a, ['account_number', 'number']),
      bankName: first(s, ['bank_name']) ?? first(a, ['bank_name', 'bank']),
      accountName: first(s, ['account_name']) ?? first(a, ['account_name', 'name']),
    };
  },

  async topUpByCard(
    amount: string,
  ): Promise<{ authorizationUrl: string | null; reference: string | null }> {
    const { data } = await http.post(ENDPOINTS.walletTopUpInitiate, { amount: Number(amount) });
    const s = unwrap(data);
    return {
      authorizationUrl: first(s, ['authorization_url', 'checkout_url', 'url']),
      reference: first(s, ['reference']),
    };
  },
};
