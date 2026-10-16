/**
 * Background sync queue for checks made at the car (16 Oct 2026 note).
 *
 * Every result is kept on the phone until the server answers for its event id.
 * Sending twice is harmless (event ids are unique), so the queue never loses an
 * item over a dropped connection. Storage is pluggable: tests use memory, the
 * app uses an encrypted file in app-private storage.
 */
import type { SyncAnswer, SyncEvent, SyncSide } from './types';

export interface QueueStorage {
  load(): Promise<SyncEvent[]>;
  save(events: SyncEvent[]): Promise<void>;
}

export class MemoryQueueStorage implements QueueStorage {
  private events: SyncEvent[] = [];
  async load() {
    return [...this.events];
  }
  async save(events: SyncEvent[]) {
    this.events = [...events];
  }
}

/** Retry delays after a failed send, as SR2Go suggested; the last one repeats. */
export const BACKOFF_MS = [10_000, 30_000, 120_000, 300_000];

export function backoffDelay(attempt: number): number {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 300_000;
}

/** Answers that mean "drop the event": the server has it, or will never take it. */
const FINAL: ReadonlySet<SyncAnswer['status']> = new Set([
  'applied',
  'applied_late',
  'recorded_late',
  'duplicate',
  'refused',
]);

export interface NewEvent {
  bookingId: string;
  side: SyncSide;
  scanned: string;
  faceMatched: boolean | null;
  reason?: string | null;
}

function uuid(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback for runtimes without randomUUID: still 8–64 chars and unique enough per phone.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class SyncQueue {
  private attempt = 0;
  private sending: Promise<void> | null = null;

  constructor(
    private readonly storage: QueueStorage,
    private readonly send: (events: SyncEvent[]) => Promise<SyncAnswer[]>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Record a check made at the car. Never waits on the network. */
  async add(e: NewEvent): Promise<SyncEvent> {
    const event: SyncEvent = {
      eventId: uuid(),
      bookingId: e.bookingId,
      side: e.side,
      scanned: e.scanned,
      faceMatched: e.faceMatched,
      reason: e.reason ?? null,
      phoneTime: this.now().toISOString(),
    };
    const list = await this.storage.load();
    list.push(event);
    await this.storage.save(list);
    return event;
  }

  async pending(): Promise<SyncEvent[]> {
    return this.storage.load();
  }

  /**
   * Try to send everything waiting. Returns the delay before the next try, or
   * null when the queue is empty. Single-flight: a second call while one is in
   * progress waits for it.
   */
  async flush(): Promise<number | null> {
    if (this.sending) {
      await this.sending;
    }
    const run = this.flushOnce();
    this.sending = run.then(
      () => undefined,
      () => undefined,
    );
    try {
      return await run;
    } finally {
      this.sending = null;
    }
  }

  private async flushOnce(): Promise<number | null> {
    let list = await this.storage.load();
    if (list.length === 0) {
      this.attempt = 0;
      return null;
    }
    try {
      while (list.length > 0) {
        const batch = list.slice(0, 50);
        const answers = await this.send(batch);
        const done = new Set(answers.filter((a) => FINAL.has(a.status)).map((a) => a.eventId));
        if (done.size === 0) throw new Error('No event was confirmed');
        list = list.filter((e) => !done.has(e.eventId));
        await this.storage.save(list);
        if (done.size < batch.length) break;
      }
      this.attempt = 0;
      return list.length === 0 ? null : backoffDelay(0);
    } catch {
      const delay = backoffDelay(this.attempt);
      this.attempt += 1;
      return delay;
    }
  }
}
