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
  checkboxLabel: string | null;
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
    const reg = obj(s.regulatory);
    return {
      enabled: s.active !== false && s.enabled !== false && s.feature_enabled !== false,
      text:
        first(reg, ['SELFIE_DISCLAIMER_TEXT']) ??
        first(s, ['disclaimer_text', 'disclaimer', 'text']),
      version:
        first(reg, ['SELFIE_DISCLAIMER_VERSION']) ?? first(s, ['disclaimer_version', 'version']),
      regulatoryBody: first(reg, ['PRIMARY_BODY']) ?? first(s, ['regulatory_body']),
      consentType: first(s, ['consent_type']) ?? 'selfie_verification',
      checkboxLabel: first(reg, ['SELFIE_CONSENT_CHECKBOX_LABEL']),
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

  /**
   * DELETE /api/users/me {password} (release 103). 401 wrong_password is a bad password,
   * not an expired session, so the request skips the refresh/sign-out handling.
   * 409 open_items carries reasons[] (open_booking, open_ride, open_dispute, unpaid_payout).
   */
  async deleteAccount(password: string): Promise<string | null> {
    const { data } = await http.delete(ENDPOINTS.usersMe, {
      data: { password },
      skipSessionHandling: true,
    });
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
  id: string | null;
  name: string | null;
  phoneMasked: string | null;
  verified: boolean;
}

export interface TopUpAccount {
  accountNumber: string | null;
  bankName: string | null;
  accountName: string | null;
}

export interface TopUpAccounts {
  status: 'ready' | 'creating' | 'not_available' | null;
  accounts: TopUpAccount[];
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
    const ms = obj(s.milestones);
    const m = obj(ms.next ?? s.next_milestone ?? s.milestone);
    const toNext = num(ms.referrals_to_next);
    const code = first(s, ['referral_code', 'code']);
    const link = first(s, ['share_link']);
    const nextName = first(m, ['name']);
    return {
      code,
      friendsJoined: num(
        stats.total_referrals ?? s.friends_joined ?? s.total_referrals ?? stats.signups,
      ),
      travelled: num(
        stats.completed_referrals ?? s.friends_travelled ?? stats.travelled ?? stats.completed,
      ),
      creditsEarned:
        first(stats, ['total_credit_earned', 'earned', 'credits']) ??
        first(s, ['credits_earned', 'total_earned']),
      milestone:
        first(m, ['text', 'description']) ??
        (nextName
          ? `${nextName}${toNext != null ? ` · ${toNext} more friend${toNext === 1 ? '' : 's'}` : ''}${num(m.bonus) != null ? ` · ₦${num(m.bonus)} bonus` : ''}`
          : first(s, ['milestone_text'])),
      shareMessage:
        first(s, ['share_message']) ??
        (code
          ? `Join me on SR2Go, the safer way to share long-distance rides in Nigeria. Use my code ${code}: ${link ?? 'https://shareride2go.com'}`
          : null),
    };
  },

  async generateCode(): Promise<string | null> {
    const { data } = await http.post(ENDPOINTS.referralGenerateCode, {});
    return first(unwrap(data), ['referral_code', 'code']);
  },

  /** 15 Oct: look-up by phone only; no avatar. */
  async giftLookup(phone: string): Promise<GiftRecipient> {
    const { data } = await http.post(ENDPOINTS.walletGiftLookup, { query: phone });
    const s = unwrap(data);
    const hit = obj(unwrapList(data, ['results', 'items'])[0]);
    const r = Object.keys(hit).length ? hit : s;
    if (!first(r, ['id', 'user_id', 'name']))
      throw new Error('No SR2Go account with that phone number.');
    return {
      id: first(r, ['id', 'user_id']),
      name: first(r, ['name', 'short_name']),
      phoneMasked: first(r, ['phone_masked', 'phone']),
      verified: r.verified === true || r.kyc_verified === true,
    };
  },

  /** 422 recipient_not_verified / invalid_amount / insufficient_balance: show the message. */
  async gift(recipientId: string, amount: string): Promise<string | null> {
    const { data } = await http.post(ENDPOINTS.walletGift, {
      recipient_id: Number(recipientId),
      amount: Number(amount),
    });
    return first(unwrap(data), ['message']);
  },

  /** Top-up endpoints are SR2Go's to confirm; 404s surface as the backend message. */
  /** Mon 26 Oct: {status, accounts: [{bank, account_number, account_name}]} (Wema + Titan-Paystack). */
  async topUpAccounts(): Promise<TopUpAccounts> {
    const { data } = await http.get(ENDPOINTS.walletTopUpAccount);
    const s = unwrap(data);
    const raw = (first(s, ['status']) ?? '') as string;
    return {
      status: (['ready', 'creating', 'not_available'] as const).find((x) => x === raw) ?? null,
      accounts: unwrapList(data, ['accounts']).map((v) => {
        const a = obj(v);
        return {
          accountNumber: first(a, ['account_number', 'number']),
          bankName: first(a, ['bank', 'bank_name']),
          accountName: first(a, ['account_name', 'name']),
        };
      }),
    };
  },

  /** Mon 26 Oct: GET /api/wallet/activity. Until then a 404 means an empty list. */
  async activity(): Promise<WalletActivity[]> {
    try {
      const { data } = await http.get(ENDPOINTS.walletActivity, { params: { limit: 50 } });
      return unwrapList(data, ['items']).map((v, i) => {
        const t = obj(v);
        return {
          id: first(t, ['id']) ?? String(i),
          description:
            first(t, ['description']) ?? (first(t, ['type']) ?? 'Ride credit').replace(/_/g, ' '),
          date: first(t, ['created_at']),
          amount: first(t, ['amount']),
          type: first(t, ['type']),
        };
      });
    } catch (e) {
      if ((e as { status?: number }).status === 404) return [];
      throw e;
    }
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
