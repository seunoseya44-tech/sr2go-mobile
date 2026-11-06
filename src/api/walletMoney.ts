/**
 * Wallet money (server releases 114-116, app screens built 1 Nov 2026).
 *
 * The user's OWN money in the SR2Go wallet, kept apart from ride credit:
 * it never expires, pays for seats, and can be withdrawn to his own bank
 * (password + one-time code). Ride credit is never withdrawable.
 *
 *   POST /api/wallet/topup/account     {consent: true} opens his top-up account numbers
 *   POST /api/wallet/topup/verify      {reference} after the card page closes
 *   GET  /api/wallet/withdraw          what he can withdraw now, his bank, his withdrawals
 *   POST /api/wallet/withdraw/start    {amount, password} -> a code goes to his phone
 *   POST /api/wallet/withdraw/confirm  {withdrawal_id, code}
 *   POST /api/wallet/refunds/{id}/to-card
 *
 * Every amount shown comes from the server; the app never calculates fees.
 */
import { ENDPOINTS, http } from './client';
import { unwrap, unwrapList } from './parsers';

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

/* ---------- top-up ---------- */

export interface TopUpCheck {
  credited: boolean;
  status: string;
  balance: number | null;
}

export function parseTopUpCheck(payload: unknown): TopUpCheck {
  const s = unwrap(payload);
  return {
    credited: s.credited === true,
    status: str(s.status) ?? 'unknown',
    balance: num(s.balance),
  };
}

/**
 * Field test 6 Nov: Paystack marked an unfinished top-up "abandoned" and the app
 * still said "If you paid, your wallet updates". These statuses mean no money moved.
 */
const UNPAID_TOP_UP = ['abandoned', 'failed', 'cancelled', 'canceled', 'reversed', 'declined'];
export function isTopUpUnpaid(check: Pick<TopUpCheck, 'credited' | 'status'>): boolean {
  return !check.credited && UNPAID_TOP_UP.includes(check.status.toLowerCase());
}

/* ---------- withdraw ---------- */

export type WithdrawalStatus =
  'code_sent' | 'review' | 'processing' | 'paid' | 'failed' | 'returned' | 'cancelled' | string;

export interface Withdrawal {
  id: string;
  amount: number | null;
  fee: number | null;
  youReceive: number | null;
  status: WithdrawalStatus;
  bank: string | null;
  createdAt: string | null;
}

export interface WithdrawInfo {
  walletBalance: number;
  withdrawable: number;
  heldCardMoney: number;
  bank: string | null;
  min: number | null;
  dailyMax: number | null;
  dailyCount: number | null;
  cardHoldDays: number | null;
  note: string | null;
  withdrawals: Withdrawal[];
}

function parseWithdrawal(v: unknown, i: number): Withdrawal {
  const w = obj(v);
  return {
    id: str(w.withdrawal_id) ?? str(w.id) ?? String(i),
    amount: num(w.amount),
    fee: num(w.fee),
    youReceive: num(w.you_receive),
    status: str(w.status) ?? 'processing',
    bank: str(w.bank),
    createdAt: str(w.created_at),
  };
}

export function parseWithdrawInfo(payload: unknown): WithdrawInfo {
  const s = unwrap(payload);
  return {
    walletBalance: num(s.wallet_balance) ?? 0,
    withdrawable: num(s.withdrawable) ?? 0,
    heldCardMoney: num(s.held_card_money) ?? 0,
    bank: str(s.bank),
    min: num(s.min),
    dailyMax: num(s.daily_max),
    dailyCount: num(s.daily_count),
    cardHoldDays: num(s.card_hold_days),
    note: str(s.note),
    withdrawals: unwrapList(payload, ['withdrawals']).map(parseWithdrawal),
  };
}

export interface WithdrawStarted {
  withdrawalId: string;
  codeSentTo: string | null;
  expiresInMinutes: number | null;
  amount: number | null;
  fee: number | null;
  youReceive: number | null;
  bank: string | null;
  /** Test servers only (OTP sandbox); never sent by the live server. */
  sandboxCode: string | null;
}

export function parseWithdrawStarted(payload: unknown): WithdrawStarted {
  const s = unwrap(payload);
  return {
    withdrawalId: str(s.withdrawal_id) ?? '',
    codeSentTo: str(s.code_sent_to),
    expiresInMinutes: num(s.expires_in_minutes),
    amount: num(s.amount),
    fee: num(s.fee),
    youReceive: num(s.you_receive),
    bank: str(s.bank),
    sandboxCode: str(s.sandbox_code),
  };
}

export interface WithdrawResult {
  status: WithdrawalStatus;
  message: string | null;
}

export function parseWithdrawResult(payload: unknown): WithdrawResult {
  const s = unwrap(payload);
  return { status: str(s.status) ?? 'processing', message: str(s.message) };
}

/** Plain words for a withdrawal's status, for the list and the result. */
export function withdrawalStatusText(status: WithdrawalStatus): string {
  switch (status) {
    case 'paid':
      return 'Paid to your bank';
    case 'processing':
      return 'On its way to your bank';
    case 'review':
      return 'Being checked by SR2Go';
    case 'code_sent':
      return 'Waiting for your code';
    case 'failed':
    case 'returned':
      return 'Not sent: the money is back in your wallet';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status.replace(/_/g, ' ');
  }
}

/** "cash-123" (wallet activity id) -> "123"; ride-credit rows have no refund entry. */
export function cashEntryId(activityId: string): string | null {
  const m = /^cash-(\d+)$/.exec(activityId);
  return m ? m[1]! : null;
}

/**
 * A refund of a card-paid seat (kind seat_refund_card) may go back to the card
 * within the server's refund_to_card_days. The server decides in the end
 * (409 too_late / already_sent / already_used show its message).
 */
export function canSendRefundToCard(
  type: string | null,
  activityId: string,
  date: string | null,
  now: number,
  days: number,
): boolean {
  if (type !== 'seat_refund_card' || !cashEntryId(activityId) || !date) return false;
  const t = new Date(date).getTime();
  return Number.isFinite(t) && now - t < days * 86_400_000;
}

export const walletMoneyApi = {
  async openTopUpAccounts(): Promise<void> {
    await http.post(ENDPOINTS.walletTopUpAccount, { consent: true });
  },

  async verifyTopUp(reference: string): Promise<TopUpCheck> {
    const { data } = await http.post(ENDPOINTS.walletTopUpVerify, { reference });
    return parseTopUpCheck(data);
  },

  async withdrawInfo(): Promise<WithdrawInfo> {
    const { data } = await http.get(ENDPOINTS.walletWithdraw);
    return parseWithdrawInfo(data);
  },

  /**
   * 401 wrong_password is a wrong password, not an expired session: the request
   * skips the refresh/sign-out handling (same as delete account).
   */
  async withdrawStart(amount: string, password: string): Promise<WithdrawStarted> {
    const { data } = await http.post(
      ENDPOINTS.walletWithdrawStart,
      { amount: Number(amount), password },
      { skipSessionHandling: true },
    );
    return parseWithdrawStarted(data);
  },

  async withdrawConfirm(withdrawalId: string, code: string): Promise<WithdrawResult> {
    const { data } = await http.post(ENDPOINTS.walletWithdrawConfirm, {
      withdrawal_id: Number(withdrawalId),
      code,
    });
    return parseWithdrawResult(data);
  },

  async refundToCard(entryId: string): Promise<string | null> {
    const { data } = await http.post(ENDPOINTS.walletRefundToCard(entryId), {});
    return str(unwrap(data).message);
  },
};
