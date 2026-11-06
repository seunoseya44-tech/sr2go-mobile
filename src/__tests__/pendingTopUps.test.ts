/**
 * Field test 6 Nov 2026: a card top-up must survive Android closing the app while
 * the Paystack page is open, and be confirmed when the app comes back.
 */
import {
  PENDING_MAX_AGE_MS,
  addPendingTopUp,
  clearPendingTopUps,
  freshPending,
  listPendingTopUps,
  removePendingTopUp,
} from '../wallet/pendingTopUps';

const mockFiles: Record<string, string> = {};

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///app/',
  getInfoAsync: jest.fn(async (path: string) => ({ exists: path in mockFiles })),
  readAsStringAsync: jest.fn(async (path: string) => mockFiles[path]),
  writeAsStringAsync: jest.fn(async (path: string, text: string) => {
    mockFiles[path] = text;
  }),
  deleteAsync: jest.fn(async (path: string) => {
    delete mockFiles[path];
  }),
}));

describe('open card top-ups kept on the phone', () => {
  beforeEach(async () => {
    await clearPendingTopUps();
  });

  it('remembers a top-up and forgets it once confirmed', async () => {
    await addPendingTopUp({ reference: 'SRG-TOPUP-1', amount: '20500', at: Date.now() });
    await addPendingTopUp({ reference: 'SRG-TOPUP-2', amount: '31500', at: Date.now() + 1 });
    expect((await listPendingTopUps()).map((p) => p.reference)).toEqual([
      'SRG-TOPUP-2',
      'SRG-TOPUP-1',
    ]);
    await removePendingTopUp('SRG-TOPUP-2');
    expect((await listPendingTopUps()).map((p) => p.reference)).toEqual(['SRG-TOPUP-1']);
  });

  it('keeps one record per reference', async () => {
    await addPendingTopUp({ reference: 'SRG-TOPUP-1', amount: '20500', at: Date.now() });
    await addPendingTopUp({ reference: 'SRG-TOPUP-1', amount: '20500', at: Date.now() + 5 });
    expect(await listPendingTopUps()).toHaveLength(1);
  });

  it('drops records older than a day, broken ones and anything past the newest 10', () => {
    const now = 1_000_000_000_000;
    const list = [
      { reference: 'old', amount: '1000', at: now - PENDING_MAX_AGE_MS - 1 },
      { reference: '', amount: '1000', at: now },
      { amount: '1000', at: now },
      'nonsense',
      ...Array.from({ length: 12 }, (_, i) => ({
        reference: `r${i}`,
        amount: '1000',
        at: now - i,
      })),
    ];
    const kept = freshPending(list, now);
    expect(kept).toHaveLength(10);
    expect(kept[0]!.reference).toBe('r0');
    expect(kept.some((p) => p.reference === 'old')).toBe(false);
    expect(freshPending('not a list', now)).toEqual([]);
  });

  it('is cleared on sign-out', async () => {
    await addPendingTopUp({ reference: 'SRG-TOPUP-9', amount: '5000', at: Date.now() });
    await clearPendingTopUps();
    expect(await listPendingTopUps()).toEqual([]);
  });
});
