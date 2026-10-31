import { parsePaymentChoices } from '../api/paymentChoices';

describe('payment choices', () => {
  it('reads the choices and nested explain texts', () => {
    const p = parsePaymentChoices({
      driver_earnings: 'wallet',
      refunds: 'bank',
      is_driver: true,
      explain: {
        driver_earnings: {
          bank: 'Paid to your bank 24 h after the trip.',
          wallet: 'Instant, use it to book.',
        },
        refunds: { wallet: 'Instant.', bank: '3 to 5 working days.' },
      },
    });
    expect(p).toMatchObject({ driverEarnings: 'wallet', refunds: 'bank', isDriver: true });
    expect(p.explain.earningsWallet).toBe('Instant, use it to book.');
    expect(p.explain.refundsBank).toBe('3 to 5 working days.');
  });

  it('reads flat explain keys and ignores unknown values', () => {
    const p = parsePaymentChoices({
      driver_earnings: 'cash',
      refunds: 'wallet',
      is_driver: false,
      explain: { refunds_wallet: 'Instant.', refunds_bank: 'Takes a few days.' },
    });
    expect(p.driverEarnings).toBeNull();
    expect(p.isDriver).toBe(false);
    expect(p.explain.refundsWallet).toBe('Instant.');
  });
});
