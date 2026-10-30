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
};

let current: AppConfig = { ...DEFAULTS };

export function appConfig(): AppConfig {
  return current;
}

const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
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
