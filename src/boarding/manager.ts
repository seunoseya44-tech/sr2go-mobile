/**
 * Pack manager and background sync (16 Oct note + Martin's answers):
 *  - download each pack from 24 h before departure whenever the app opens or
 *    signal returns; replace it when `pack_version` differs; photos at once
 *    (30-minute links); then POST ".../saved";
 *  - keep every check in the queue until the server answers; retry
 *    10 s, 30 s, 2 min, then every 5 min; never block boarding on it;
 *  - delete packs at expiry; the queue outlives the trip.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { boardingApi } from '../api/boarding';
import { bookingsApi } from '../api/bookings';
import { driverApi } from '../api/driver';
import { toApiError } from '../api/errors';
import { SyncQueue } from './queue';
import { FileQueueStorage, packStore } from './store';
import type { DriverPack, PassengerPack } from './types';
import * as FS from 'expo-file-system/legacy';
import { fromB64 } from './crypto';

const DAY_MS = 24 * 60 * 60 * 1000;

/* ---------- the one queue ---------- */

export const boardingSync = new SyncQueue(new FileQueueStorage(), (events) =>
  boardingApi.sync(events),
);

let pendingCount = 0;
const listeners = new Set<() => void>();
async function refreshPending() {
  pendingCount = (await boardingSync.pending()).length;
  listeners.forEach((l) => l());
}

/** How many checks are still waiting to reach the server ("Saved - will send…"). */
export function usePendingSync(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      void refreshPending();
      return () => {
        listeners.delete(l);
      };
    },
    () => pendingCount,
    () => pendingCount,
  );
}

let retryTimer: ReturnType<typeof setTimeout> | null = null;

/** Sends the queue now and schedules the next try from the returned delay. */
export async function flushSync(): Promise<void> {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  const delay = await boardingSync.flush();
  await refreshPending();
  if (delay != null) retryTimer = setTimeout(() => void flushSync(), delay);
}

/** Records a check made at the car, then tries to send straight away. */
export async function recordCheck(e: Parameters<SyncQueue['add']>[0]): Promise<void> {
  await boardingSync.add(e);
  await refreshPending();
  void flushSync();
}

/* ---------- packs ---------- */

/** Item 16: download through the file system (reliable for signed links), then read the bytes. */
async function fetchBytes(url: string): Promise<Uint8Array | null> {
  const tmp = `${FS.cacheDirectory ?? ''}boarding-photo-${Date.now()}.jpg`;
  try {
    const res = await FS.downloadAsync(url, tmp);
    if (res.status !== 200) return null;
    return fromB64(await FS.readAsStringAsync(tmp, { encoding: FS.EncodingType.Base64 }));
  } catch {
    return null;
  } finally {
    await FS.deleteAsync(tmp, { idempotent: true }).catch(() => undefined);
  }
}

function withinWindow(departureIso: string | null): boolean {
  if (!departureIso) return false;
  const t = Date.parse(departureIso);
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  return t - now <= DAY_MS && t + DAY_MS >= now;
}

async function savePassengerPack(bookingId: string): Promise<PassengerPack | null> {
  const existing = await packStore.getPassenger(bookingId);
  let pack: PassengerPack;
  try {
    pack = await boardingApi.passengerPack(bookingId);
  } catch (e) {
    // 409 pack_not_yet / no_boarding_pass / held / not_boardable: nothing to store.
    if (toApiError(e).status === 409) return existing;
    throw e;
  }
  const photoKept =
    existing?.packVersion === pack.packVersion &&
    (await packStore.hasPhoto('passenger', bookingId, 'driver'));
  if (!photoKept && pack.driver.photo) {
    const bytes = await fetchBytes(pack.driver.photo);
    if (bytes) await packStore.savePhoto('passenger', bookingId, 'driver', bytes);
  }
  await packStore.save({
    kind: 'passenger',
    id: bookingId,
    pack: { ...pack, driver: { ...pack.driver, photo: null } },
    savedAt: new Date().toISOString(),
  });
  if (!existing || existing.packVersion !== pack.packVersion) {
    await boardingApi.passengerPackSaved(bookingId).catch(() => undefined);
  }
  return pack;
}

async function saveDriverPack(rideId: string): Promise<DriverPack | null> {
  const existing = await packStore.getDriver(rideId);
  let pack: DriverPack;
  try {
    pack = await boardingApi.driverPack(rideId);
  } catch (e) {
    if (toApiError(e).status === 409) return existing;
    throw e;
  }
  for (const p of pack.passengers) {
    const kept =
      existing?.packVersion === pack.packVersion &&
      (await packStore.hasPhoto('driver', rideId, p.bookingId));
    if (!kept && p.photo) {
      const bytes = await fetchBytes(p.photo);
      if (bytes) await packStore.savePhoto('driver', rideId, p.bookingId, bytes);
    }
  }
  await packStore.save({
    kind: 'driver',
    id: rideId,
    pack: { ...pack, passengers: pack.passengers.map((p) => ({ ...p, photo: null })) },
    savedAt: new Date().toISOString(),
  });
  if (!existing || existing.packVersion !== pack.packVersion) {
    await boardingApi.driverPackSaved(rideId).catch(() => undefined);
  }
  return pack;
}

let syncing: Promise<void> | null = null;
/** Item 11: only drivers have rides of their own; passengers never call my-rides (403). */
let driverAccount = false;
let lastSync = 0;

/** Downloads/refreshes every pack inside the 24 h window; quiet on failure. */
export function syncPacks(force = false): Promise<void> {
  if (syncing) return syncing;
  // Item 11: app open, foreground and network-back fire together; one run is enough.
  if (!force && Date.now() - lastSync < 30_000) return Promise.resolve();
  lastSync = Date.now();
  syncing = (async () => {
    try {
      await packStore.cleanupExpired();
      const bookings = await bookingsApi.mine().catch(() => []);
      for (const b of bookings) {
        const dep = b.departureDate ? `${b.departureDate}T${b.departureTime ?? '00:00'}:00` : null;
        if (b.paymentStatus === 'paid' && b.status !== 'cancelled' && withinWindow(dep)) {
          await savePassengerPack(b.id).catch(() => undefined);
        }
      }
      const rides = driverAccount ? await driverApi.myRides().catch(() => []) : [];
      for (const r of rides) {
        const dep = r.departureDate ? `${r.departureDate}T${r.departureTime ?? '00:00'}:00` : null;
        if ((r.status === 'scheduled' || r.status === 'active') && withinWindow(dep)) {
          await saveDriverPack(r.id).catch(() => undefined);
        }
      }
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

/** One pack on demand (opening a boarding pass or the driver boarding screen). */
export const packs = {
  passenger: (bookingId: string) =>
    savePassengerPack(bookingId).catch(() => packStore.getPassenger(bookingId)),
  driver: (rideId: string) => saveDriverPack(rideId).catch(() => packStore.getDriver(rideId)),
};

/**
 * Mount once while signed in: flushes the queue and refreshes packs on app
 * open, on return to the foreground and when the connection comes back.
 */
export function useBoardingBackground(enabled: boolean, isDriver = false) {
  useEffect(() => {
    driverAccount = isDriver;
  }, [isDriver]);
  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      void flushSync();
      void syncPacks();
    };
    run();
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    const net = NetInfo.addEventListener((state) => {
      if (state.isInternetReachable) run();
    });
    return () => {
      app.remove();
      net();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [enabled]);
}
