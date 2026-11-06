import { parseWallet } from '../api/account';
import { parseInitiation } from '../api/bookings';
import { toApiError } from '../api/errors';
import {
  canSendRefundToCard,
  cashEntryId,
  isTopUpUnpaid,
  parseTopUpCheck,
  parseWithdrawInfo,
  parseWithdrawStarted,
  withdrawalStatusText,
} from '../api/walletMoney';

describe('wallet money (server releases 114-116)', () => {
  it('keeps the user money apart from ride credit', () => {
    const w = parseWallet({
      balance: 1200,
      wallet_money: 5400.5,
      wallet_money_note: 'Your own money: it never expires.',
      transactions: [],
    });
    expect(w.balance).toBe('1200');
    expect(w.walletMoney).toBe('5400.5');
    expect(w.walletMoneyNote).toBe('Your own money: it never expires.');
  });

  it('reads what can be withdrawn, the card hold and past withdrawals', () => {
    const i = parseWithdrawInfo({
      wallet_balance: 9000,
      withdrawable: 6740,
      held_card_money: 2260,
      bank: 'GTBank ****6789',
      min: 1000,
      daily_max: 200000,
      daily_count: 3,
      card_hold_days: 7,
      withdrawals: [
        {
          withdrawal_id: 4,
          amount: 2000,
          fee: 10,
          you_receive: 1990,
          status: 'paid',
          bank: 'GTBank ****6789',
        },
      ],
    });
    expect(i).toMatchObject({
      withdrawable: 6740,
      heldCardMoney: 2260,
      bank: 'GTBank ****6789',
      min: 1000,
    });
    expect(i.withdrawals[0]).toMatchObject({ id: '4', youReceive: 1990, status: 'paid' });
  });

  it('reads the code step: fee and amount received come from the server', () => {
    const s = parseWithdrawStarted({
      withdrawal_id: 12,
      code_sent_to: 'sms',
      expires_in_minutes: 10,
      amount: 5000,
      fee: 10,
      you_receive: 4990,
      bank: 'GTBank ****6789',
    });
    expect(s).toMatchObject({ withdrawalId: '12', fee: 10, youReceive: 4990, sandboxCode: null });
  });

  it('keeps tries left and deletion reason codes from errors', () => {
    const wrong = toApiError({
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          detail: { error: 'wrong_code', message: 'The code is not correct.', tries_left: 2 },
        },
      },
    });
    expect(wrong.code).toBe('wrong_code');
    expect(wrong.extra.triesLeft).toBe(2);
    const del = toApiError({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          detail: {
            error: 'open_items',
            message: 'x',
            reasons: [{ code: 'wallet_money', ids: [], message: 'Withdraw it first.' }],
          },
        },
      },
    });
    expect(del.extra.reasons).toEqual(['Withdraw it first.']);
    expect(del.extra.reasonCodes).toEqual(['wallet_money']);
  });

  it('knows a seat paid from the wallet', () => {
    const q = parseInitiation({
      paid: true,
      paid_from: 'wallet',
      wallet_used: 4520,
      you_pay: 4520,
      wallet_balance: 980,
    });
    expect(q.paidFromWallet).toBe(true);
    expect(q.walletUsed).toBe('4520');
    expect(q.creditsAvailable).toBeNull(); // wallet_balance is wallet money, never ride credit
  });

  it('offers "back to card" only on card refunds still inside the window', () => {
    const now = Date.parse('2026-11-01T12:00:00Z');
    expect(canSendRefundToCard('seat_refund_card', 'cash-9', '2026-10-20T12:00:00Z', now, 30)).toBe(
      true,
    );
    expect(canSendRefundToCard('seat_refund_card', 'cash-9', '2026-09-20T12:00:00Z', now, 30)).toBe(
      false,
    );
    expect(canSendRefundToCard('seat_refund', 'cash-9', '2026-10-31T12:00:00Z', now, 30)).toBe(
      false,
    );
    expect(
      canSendRefundToCard('seat_refund_card', 'credit-9', '2026-10-31T12:00:00Z', now, 30),
    ).toBe(false);
    expect(cashEntryId('cash-123')).toBe('123');
  });

  it('reads the top-up check and says each withdrawal status in words', () => {
    expect(parseTopUpCheck({ credited: true, status: 'success', balance: 5000 })).toEqual({
      credited: true,
      status: 'success',
      balance: 5000,
    });
    expect(withdrawalStatusText('review')).toBe('Being checked by SR2Go');
    expect(withdrawalStatusText('failed')).toMatch(/back in your wallet/);
  });
});

describe('unfinished top-up (field test 6 Nov)', () => {
  it('says not paid only when Paystack says no money moved', () => {
    expect(isTopUpUnpaid({ credited: false, status: 'abandoned' })).toBe(true);
    expect(isTopUpUnpaid({ credited: false, status: 'Failed' })).toBe(true);
    expect(isTopUpUnpaid({ credited: false, status: 'pending' })).toBe(false);
    expect(isTopUpUnpaid({ credited: false, status: 'unknown' })).toBe(false);
    expect(isTopUpUnpaid({ credited: true, status: 'success' })).toBe(false);
  });
});
