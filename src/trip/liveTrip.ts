/**
 * Live trip tracking on the driver's phone (server release 128, Martin 6 Nov 2026).
 *
 * Field test 6 Nov: the position was sent only while the trip screen was open
 * (every 5 minutes), so it stopped when the phone was locked and families saw
 * the car 12 minutes late. Now, from "Start ride" until the trip ends, Android
 * sends the car's position in the background (a "SR2Go is sharing your trip"
 * notification shows meanwhile) every `live_position_seconds` once the car has
 * moved `live_position_min_meters` - both from /api/app/config. The server keeps
 * only the latest and stores the 5-minute evidence point itself.
 *
 * The ride being tracked is saved in the app's private folder, so tracking goes
 * on if Android restarts the app. It stops when the trip is completed, when the
 * server says the ride is no longer on the road, and on sign-out.
 */
import * as FS from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { driverApi } from '../api/driver';
import { toApiError } from '../api/errors';
import { session } from '../auth/session';
import { appConfig } from '../config/appConfig';
import { askBackgroundLocationConsent } from './locationDisclosure';

export const LIVE_TRIP_TASK = 'sr2go-live-trip';
const FILE = `${FS.documentDirectory ?? ''}live-trip.json`;

export interface LiveTripState {
  rideId: string;
  startedAt: number;
  /** When the server last accepted a position (ms), or null. */
  lastSentAt: number | null;
}

export async function liveTripState(): Promise<LiveTripState | null> {
  try {
    const info = await FS.getInfoAsync(FILE);
    if (!info.exists) return null;
    const s = JSON.parse(await FS.readAsStringAsync(FILE)) as LiveTripState;
    return s && typeof s.rideId === 'string' && s.rideId ? s : null;
  } catch {
    return null;
  }
}

async function saveState(s: LiveTripState): Promise<void> {
  await FS.writeAsStringAsync(FILE, JSON.stringify(s)).catch(() => undefined);
}

/** The server's answers that mean "stop sending for this ride". */
export function stopsTracking(status: number | null | undefined): boolean {
  return status === 403 || status === 404 || status === 409;
}

/** Sends one position for the saved ride. Returns false when tracking should stop. */
export async function sendPosition(
  rideId: string,
  loc: Pick<Location.LocationObject, 'coords'>,
): Promise<boolean> {
  if (!session.getTokens()) await session.load(); // the app may have been restarted in the background
  try {
    const r = await driverApi.livePosition(rideId, {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracyM: loc.coords.accuracy ?? null,
      speedKmh: loc.coords.speed != null && loc.coords.speed >= 0 ? loc.coords.speed * 3.6 : null,
      heading: loc.coords.heading != null && loc.coords.heading >= 0 ? loc.coords.heading : null,
    });
    if (r.accepted) {
      const s = await liveTripState();
      if (s && s.rideId === rideId) await saveState({ ...s, lastSentAt: Date.now() });
    }
    return true;
  } catch (e) {
    return !stopsTracking(toApiError(e).status);
  }
}

// Runs for every batch of positions Android delivers, also with the phone locked.
TaskManager.defineTask(LIVE_TRIP_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const last = locations?.[locations.length - 1];
  if (!last) return;
  const s = await liveTripState();
  if (!s) {
    await stopLiveTrip();
    return;
  }
  const keepGoing = await sendPosition(s.rideId, last);
  if (!keepGoing) await stopLiveTrip();
});

export type LiveTripStart = 'background' | 'screen_only' | 'denied';

/**
 * Starts background sending for this ride (safe to call again). 'screen_only':
 * the driver did not allow location "all the time", so the trip screen sends
 * while it is open; 'denied': no location at all.
 */
export function startLiveTrip(rideId: string): Promise<LiveTripStart> {
  // Start ride and the trip screen both call this within a second: one start, one disclosure.
  if (!starting) starting = doStart(rideId).finally(() => (starting = null));
  return starting;
}
let starting: Promise<LiveTripStart> | null = null;

async function doStart(rideId: string): Promise<LiveTripStart> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';
  const prev = await liveTripState();
  await saveState(
    prev && prev.rideId === rideId ? prev : { rideId, startedAt: Date.now(), lastSentAt: null },
  );
  let bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted' && bg.canAskAgain) {
    // Google Play: the app's own explanation comes first, then Android's prompt.
    if (!(await askBackgroundLocationConsent())) return 'screen_only';
    bg = await Location.requestBackgroundPermissionsAsync();
  }
  if (bg.status !== 'granted') return 'screen_only';
  if (await Location.hasStartedLocationUpdatesAsync(LIVE_TRIP_TASK).catch(() => false)) {
    return 'background';
  }
  const cfg = appConfig();
  await Location.startLocationUpdatesAsync(LIVE_TRIP_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: cfg.livePositionSeconds * 1000,
    distanceInterval: cfg.livePositionMinMeters,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'SR2Go is sharing your trip',
      notificationBody: 'Families can follow the car until the trip ends.',
      notificationColor: '#0099F9',
      killServiceOnDestroy: false,
    },
  });
  return 'background';
}

/** Stops sending and forgets the ride (trip completed, ride ended, sign-out). */
export async function stopLiveTrip(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LIVE_TRIP_TASK)) {
      await Location.stopLocationUpdatesAsync(LIVE_TRIP_TASK);
    }
  } catch {
    // not started
  }
  await FS.deleteAsync(FILE, { idempotent: true }).catch(() => undefined);
}
