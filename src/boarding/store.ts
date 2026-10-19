/**
 * Encrypted on-device store for boarding packs, their photos and the sync
 * queue. Everything lives under the app's document directory (never the
 * gallery) and is deleted at trip end, cancellation or pack expiry.
 */
import * as FS from 'expo-file-system/legacy';

import { decrypt, encrypt, toB64, utf8 } from './crypto';
import type { QueueStorage } from './queue';
import type { DriverPack, PassengerPack, SyncEvent } from './types';

const ROOT = `${FS.documentDirectory ?? ''}boarding/`;

async function ensureRoot() {
  const info = await FS.getInfoAsync(ROOT);
  if (!info.exists) await FS.makeDirectoryAsync(ROOT, { intermediates: true });
}

async function writeEncrypted(name: string, bytes: Uint8Array) {
  await ensureRoot();
  await FS.writeAsStringAsync(ROOT + name, await encrypt(bytes), { encoding: 'utf8' });
}

async function readEncrypted(name: string): Promise<Uint8Array | null> {
  const info = await FS.getInfoAsync(ROOT + name);
  if (!info.exists) return null;
  try {
    return await decrypt(await FS.readAsStringAsync(ROOT + name, { encoding: 'utf8' }));
  } catch {
    return null;
  }
}

async function remove(name: string) {
  await FS.deleteAsync(ROOT + name, { idempotent: true });
}

export type StoredPack =
  | { kind: 'passenger'; id: string; pack: PassengerPack; savedAt: string }
  | { kind: 'driver'; id: string; pack: DriverPack; savedAt: string };

const packName = (kind: 'passenger' | 'driver', id: string) => `pack-${kind}-${id}.json.enc`;
const photoName = (kind: 'passenger' | 'driver', id: string, who: string) =>
  `photo-${kind}-${id}-${who}.jpg.enc`;

export const packStore = {
  async save(entry: StoredPack): Promise<void> {
    await writeEncrypted(packName(entry.kind, entry.id), utf8.encode(JSON.stringify(entry)));
  },

  async getPassenger(bookingId: string): Promise<PassengerPack | null> {
    const raw = await readEncrypted(packName('passenger', bookingId));
    if (!raw) return null;
    const entry = JSON.parse(utf8.decode(raw)) as StoredPack;
    return entry.kind === 'passenger' ? entry.pack : null;
  },

  async getDriver(rideId: string): Promise<DriverPack | null> {
    const raw = await readEncrypted(packName('driver', rideId));
    if (!raw) return null;
    const entry = JSON.parse(utf8.decode(raw)) as StoredPack;
    return entry.kind === 'driver' ? entry.pack : null;
  },

  /** Stores an already-downloaded photo, encrypted. */
  async savePhoto(kind: 'passenger' | 'driver', id: string, who: string, bytes: Uint8Array) {
    await writeEncrypted(photoName(kind, id, who), bytes);
  },

  /** Decrypts a photo into a data URI for an <Image>; never written to disk in the clear. */
  async photoUri(kind: 'passenger' | 'driver', id: string, who: string): Promise<string | null> {
    const bytes = await readEncrypted(photoName(kind, id, who));
    return bytes ? `data:image/jpeg;base64,${toB64(bytes)}` : null;
  },

  async hasPhoto(kind: 'passenger' | 'driver', id: string, who: string): Promise<boolean> {
    return (await FS.getInfoAsync(ROOT + photoName(kind, id, who))).exists;
  },

  /** Deletes the pack and every photo that belongs to it. */
  async delete(kind: 'passenger' | 'driver', id: string): Promise<void> {
    await ensureRoot();
    const names = await FS.readDirectoryAsync(ROOT).catch(() => [] as string[]);
    const prefix = `-${kind}-${id}`;
    await Promise.all(
      names.filter((n) => n.includes(prefix)).map((n) => remove(n).catch(() => undefined)),
    );
  },

  /** Every stored pack, for expiry clean-up. */
  async list(): Promise<StoredPack[]> {
    await ensureRoot();
    const names = await FS.readDirectoryAsync(ROOT).catch(() => [] as string[]);
    const out: StoredPack[] = [];
    for (const n of names.filter((x) => x.startsWith('pack-'))) {
      const raw = await readEncrypted(n);
      if (!raw) continue;
      try {
        out.push(JSON.parse(utf8.decode(raw)) as StoredPack);
      } catch {
        await remove(n).catch(() => undefined);
      }
    }
    return out;
  },

  /** Removes packs past `expires_at` (24 h after departure per SR2Go). */
  async cleanupExpired(now = Date.now()): Promise<number> {
    let removed = 0;
    for (const entry of await this.list()) {
      const exp = entry.pack.expiresAt ? Date.parse(entry.pack.expiresAt) : NaN;
      if (!Number.isNaN(exp) && exp < now) {
        await this.delete(entry.kind, entry.id);
        removed += 1;
      }
    }
    return removed;
  },

  /** On sign-out: nothing of another person's trip stays on the phone. */
  async wipe(): Promise<void> {
    await FS.deleteAsync(ROOT, { idempotent: true });
  },
};

/** Sync queue persisted encrypted next to the packs; survives restarts. */
export class FileQueueStorage implements QueueStorage {
  private readonly name = 'sync-queue.json.enc';

  async load(): Promise<SyncEvent[]> {
    const raw = await readEncrypted(this.name);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(utf8.decode(raw)) as unknown;
      return Array.isArray(parsed) ? (parsed as SyncEvent[]) : [];
    } catch {
      return [];
    }
  }

  async save(events: SyncEvent[]): Promise<void> {
    await writeEncrypted(this.name, utf8.encode(JSON.stringify(events)));
  }
}
