/**
 * Server-driven settings (release 109, 30 Oct): GET /api/app/config gives the
 * time zone, UTC offset, currency, support contacts and the selfie retry
 * window. Martin: read them there instead of fixing them in the app. The
 * defaults below are only used until the first answer arrives (or offline).
 */
import { ENDPOINTS, http } from '../api/client';

export interface AppConfig {
  timezone: string;
  utcOffsetMinutes: number;
  currency: string;
  currencySymbol: string;
  supportPhone: string;
  supportEmail: string;
  supportHours: string | null;
  selfieRetryMinutes: number;
  /** Release 118 (review 1 Nov): code validity and card-money hold, from the server. */
  otpExpiryMinutes: number;
  withdrawCodeMinutes: number;
  cardHoldDays: number;
  /** Release 118: wallet top-up switch and limits (the app had its own switch, FEATURES.topUp). */
  walletTopUpEnabled: boolean;
  walletTopUpMin: number;
  walletTopUpMax: number;
  withdrawMin: number;
  refundToCardDays: number;
  /** Server release 122 (2 Nov): false = the wallet is a prepaid ride balance - no withdrawal to a bank. */
  walletWithdrawEnabled: boolean;
}

const DEFAULTS: AppConfig = {
  timezone: 'Africa/Lagos',
  utcOffsetMinutes: 60,
  currency: 'NGN',
  currencySymbol: '₦',
  supportPhone: '+2349053451158',
  supportEmail: 'support@shareride2go.com',
  supportHours: null,
  selfieRetryMinutes: 60,
  otpExpiryMinutes: 10,
  withdrawCodeMinutes: 10,
  cardHoldDays: 7,
  walletTopUpEnabled: false,
  walletTopUpMin: 500,
  walletTopUpMax: 200000,
  withdrawMin: 1000,
  refundToCardDays: 30,
  walletWithdrawEnabled: false,
};

let current: AppConfig = { ...DEFAULTS };

export function appConfig(): AppConfig {
  return current;
}

const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const str = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v : fallback);

/** Reads /api/app/config once at start; failures keep the last known values. */
export async function loadAppConfig(): Promise<AppConfig> {
  try {
    const { data } = await http.get(ENDPOINTS.appConfig, { skipSessionHandling: true });
    const s = (data ?? {}) as Record<string, unknown>;
    current = {
      timezone: str(s.timezone, current.timezone),
      utcOffsetMinutes: num(s.utc_offset_minutes, current.utcOffsetMinutes),
      currency: str(s.currency, current.currency),
      currencySymbol: str(s.currency_symbol, current.currencySymbol),
      supportPhone: str(s.support_phone, current.supportPhone),
      supportEmail: str(s.support_email, current.supportEmail),
      supportHours: typeof s.support_hours === 'string' ? s.support_hours : current.supportHours,
      selfieRetryMinutes: num(s.selfie_retry_minutes, current.selfieRetryMinutes),
      otpExpiryMinutes: num(s.otp_expiry_minutes, current.otpExpiryMinutes),
      withdrawCodeMinutes: num(s.withdraw_code_minutes, current.withdrawCodeMinutes),
      cardHoldDays: num(s.card_hold_days, current.cardHoldDays),
      walletTopUpEnabled: bool(s.wallet_topup_enabled, current.walletTopUpEnabled),
      walletTopUpMin: num(s.wallet_topup_min, current.walletTopUpMin),
      walletTopUpMax: num(s.wallet_topup_max, current.walletTopUpMax),
      withdrawMin: num(s.withdraw_min, current.withdrawMin),
      refundToCardDays: num(s.refund_to_card_days, current.refundToCardDays),
      walletWithdrawEnabled: bool(s.wallet_withdraw_enabled, current.walletWithdrawEnabled),
    };
  } catch {
    // keep defaults / last values
  }
  return current;
}

/** Tests only. */
export function setAppConfigForTests(patch: Partial<AppConfig>) {
  current = { ...current, ...patch };
}
