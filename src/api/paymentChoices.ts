/**
 * Payment choices (item 7, 31 Oct): GET / PUT /api/wallet/preferences.
 * driver_earnings: bank | wallet; refunds: wallet | bank; is_driver; explain{...}.
 * The explain texts are shown as sent; their keys are read tolerantly until
 * the answer is confirmed on staging.
 */
import { ENDPOINTS, http } from './client';
import { unwrap } from './parsers';

export type PayoutTarget = 'bank' | 'wallet';

export interface PaymentChoices {
  driverEarnings: PayoutTarget | null;
  refunds: PayoutTarget | null;
  isDriver: boolean;
  explain: {
    earningsBank: string | null;
    earningsWallet: string | null;
    refundsWallet: string | null;
    refundsBank: string | null;
    general: string | null;
  };
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const target = (v: unknown): PayoutTarget | null => (v === 'bank' || v === 'wallet' ? v : null);

/** explain may be flat ("driver_earnings_bank") or nested ({driver_earnings: {bank}}). */
function pick(ex: Json, field: string, option: string): string | null {
  const nested = obj(ex[field]);
  return str(nested[option]) ?? str(ex[`${field}_${option}`]) ?? str(ex[`${option}_${field}`]);
}

export function parsePaymentChoices(payload: unknown): PaymentChoices {
  const s = unwrap(payload);
  const ex = obj(s.explain);
  const fieldText = (f: string) => str(ex[f]);
  return {
    driverEarnings: target(s.driver_earnings),
    refunds: target(s.refunds),
    isDriver: s.is_driver === true,
    explain: {
      earningsBank: pick(ex, 'driver_earnings', 'bank') ?? fieldText('driver_earnings'),
      earningsWallet: pick(ex, 'driver_earnings', 'wallet'),
      refundsWallet: pick(ex, 'refunds', 'wallet') ?? fieldText('refunds'),
      refundsBank: pick(ex, 'refunds', 'bank'),
      general: str(ex.general) ?? str(ex.note),
    },
  };
}

export const paymentChoicesApi = {
  async get(): Promise<PaymentChoices> {
    const { data } = await http.get(ENDPOINTS.walletPreferences);
    return parsePaymentChoices(data);
  },
  async set(p: { driverEarnings?: PayoutTarget; refunds?: PayoutTarget }): Promise<PaymentChoices> {
    const { data } = await http.put(ENDPOINTS.walletPreferences, {
      ...(p.driverEarnings ? { driver_earnings: p.driverEarnings } : {}),
      ...(p.refunds ? { refunds: p.refunds } : {}),
    });
    return parsePaymentChoices(data);
  },
};
