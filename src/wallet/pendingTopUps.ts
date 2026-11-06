/**
 * Field test, 6 Nov 2026: Android closed the app while the user was on the
 * Paystack page. The app came back without the top-up reference it was holding
 * in memory, never asked the server, and showed no new balance, so the user
 * paid again (two top-ups of N20,500 were credited only by the server's own
 * 10-minute re-check).
 *
 * Every card top-up is now written to the phone the moment its Paystack page
 * opens, and checked with the server again whenever the wallet, the top-up or
 * the seat payment screen is shown, or the app comes back to the front, until
 * the server confirms it (or it is a day old: the server keeps checking it on
 * its own). Saved in the app's private folder; holds only the reference, the
 * amount and the time. Cleared on sign-out.
 */
import * as FS from 'expo-file-system/legacy';

export interface PendingTopUp {
  reference: string;
  amount: string;
  /** When the Paystack page was opened (ms). */
  at: number;
}

const FILE = `${FS.documentDirectory ?? ''}pending-topups.json`;
/** After this the server's own re-check (and its "not paid" close) is the only follow-up. */
export const PENDING_MAX_AGE_MS = 24 * 3_600_000;
const MAX_KEPT = 10;

/** The records still worth checking: valid, younger than a day, newest 10. */
export function freshPending(list: unknown, now: number): PendingTopUp[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter(
      (p): p is PendingTopUp =>
        !!p &&
        typeof p === 'object' &&
        typeof (p as PendingTopUp).reference === 'string' &&
        (p as PendingTopUp).reference.length > 0 &&
        typeof (p as PendingTopUp).at === 'number' &&
        now - (p as PendingTopUp).at < PENDING_MAX_AGE_MS,
    )
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_KEPT);
}

async function read(): Promise<PendingTopUp[]> {
  try {
    const info = await FS.getInfoAsync(FILE);
    if (!info.exists) return [];
    return freshPending(JSON.parse(await FS.readAsStringAsync(FILE)), Date.now());
  } catch {
    return [];
  }
}

async function write(list: PendingTopUp[]): Promise<void> {
  await FS.writeAsStringAsync(FILE, JSON.stringify(list)).catch(() => undefined);
}

export async function listPendingTopUps(): Promise<PendingTopUp[]> {
  return read();
}

export async function addPendingTopUp(p: PendingTopUp): Promise<void> {
  const list = (await read()).filter((x) => x.reference !== p.reference);
  await write(freshPending([p, ...list], Date.now()));
}

export async function removePendingTopUp(reference: string): Promise<void> {
  const list = await read();
  const next = list.filter((x) => x.reference !== reference);
  if (next.length !== list.length) await write(next);
}

export async function clearPendingTopUps(): Promise<void> {
  await FS.deleteAsync(FILE, { idempotent: true }).catch(() => undefined);
}
