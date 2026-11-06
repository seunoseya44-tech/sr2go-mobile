/**
 * Server release 128 (6 Nov 2026): the driver's phone shares the car's position in the
 * background every few seconds from Start ride until the trip ends.
 */
import { driverApi } from '../api/driver';
import { ApiError } from '../api/errors';
import { session } from '../auth/session';
import { loadAppConfig } from '../config/appConfig';
import {
  LIVE_TRIP_TASK,
  liveTripState,
  sendPosition,
  startLiveTrip,
  stopLiveTrip,
  stopsTracking,
} from '../trip/liveTrip';

const mockFiles: Record<string, string> = {};
const mockLocation = {
  fg: 'granted',
  bg: 'granted',
  started: false,
  options: null as null | Record<string, unknown>,
};

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///app/',
  getInfoAsync: jest.fn(async (p: string) => ({ exists: p in mockFiles })),
  readAsStringAsync: jest.fn(async (p: string) => mockFiles[p]),
  writeAsStringAsync: jest.fn(async (p: string, t: string) => {
    mockFiles[p] = t;
  }),
  deleteAsync: jest.fn(async (p: string) => {
    delete mockFiles[p];
  }),
}));
jest.mock('expo-task-manager', () => ({
  // the module defines its task when it is imported, before this file's constants exist
  defineTask: (name: string, fn: unknown) => {
    const g = globalThis as unknown as { mockTasks?: Record<string, unknown> };
    g.mockTasks = { ...(g.mockTasks ?? {}), [name]: fn };
  },
}));
jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  ActivityType: { AutomotiveNavigation: 2 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: mockLocation.fg })),
  getBackgroundPermissionsAsync: jest.fn(async () => ({
    status: mockLocation.bg,
    canAskAgain: false,
  })),
  requestBackgroundPermissionsAsync: jest.fn(async () => ({ status: mockLocation.bg })),
  hasStartedLocationUpdatesAsync: jest.fn(async () => mockLocation.started),
  startLocationUpdatesAsync: jest.fn(async (_n: string, o: Record<string, unknown>) => {
    mockLocation.started = true;
    mockLocation.options = o;
  }),
  stopLocationUpdatesAsync: jest.fn(async () => {
    mockLocation.started = false;
  }),
}));
jest.mock('../api/driver', () => ({ driverApi: { livePosition: jest.fn() } }));
jest.mock('../auth/session', () => ({
  session: { getTokens: jest.fn(() => ({ accessToken: 't' })), load: jest.fn() },
}));
jest.mock('../api/client', () => ({
  ENDPOINTS: { appConfig: '/api/app/config' },
  http: {
    get: jest.fn(async () => ({
      data: { live_position_seconds: 12, live_position_min_meters: 30 },
    })),
  },
}));

const pos = {
  coords: {
    latitude: 6.03,
    longitude: 6.92,
    accuracy: 8,
    speed: 20,
    heading: 45,
    altitude: null,
    altitudeAccuracy: null,
  },
};
const live = driverApi.livePosition as jest.Mock;
const runTask = (data: unknown) =>
  (
    (
      globalThis as unknown as {
        mockTasks: Record<string, (b: { data?: unknown }) => Promise<void>>;
      }
    ).mockTasks[LIVE_TRIP_TASK] as (b: { data?: unknown }) => Promise<void>
  )({ data });

describe('live trip tracking on the driver phone', () => {
  beforeEach(async () => {
    await stopLiveTrip();
    Object.assign(mockLocation, { fg: 'granted', bg: 'granted', started: false, options: null });
    live.mockReset();
  });

  it('starts background sending with the server settings and a visible notification', async () => {
    await loadAppConfig();
    expect(await startLiveTrip('25')).toBe('background');
    expect(mockLocation.options).toMatchObject({
      timeInterval: 12_000,
      distanceInterval: 30,
      foregroundService: { notificationTitle: 'SR2Go is sharing your trip' },
    });
    expect((await liveTripState())?.rideId).toBe('25');
  });

  it('falls back to the trip screen when location is not allowed all the time', async () => {
    mockLocation.bg = 'denied';
    expect(await startLiveTrip('25')).toBe('screen_only');
    expect(mockLocation.started).toBe(false);
    mockLocation.fg = 'denied';
    expect(await startLiveTrip('25')).toBe('denied');
  });

  it('sends each position in km/h and remembers when the server took it', async () => {
    await startLiveTrip('25');
    live.mockResolvedValue({ accepted: true, nextSeconds: 10 });
    await runTask({ locations: [pos] });
    expect(live).toHaveBeenCalledWith('25', {
      latitude: 6.03,
      longitude: 6.92,
      accuracyM: 8,
      speedKmh: 72,
      heading: 45,
    });
    expect((await liveTripState())?.lastSentAt).toEqual(expect.any(Number));
    expect(session.load).not.toHaveBeenCalled();
  });

  it('stops by itself when the server says the ride is no longer on the road', async () => {
    await startLiveTrip('25');
    live.mockRejectedValue(new ApiError('unknown', 'The trip is not on the road', 409));
    await runTask({ locations: [pos] });
    expect(mockLocation.started).toBe(false);
    expect(await liveTripState()).toBeNull();
  });

  it('keeps going through a missed position (no signal)', async () => {
    live.mockRejectedValue(new ApiError('network', 'offline'));
    expect(await sendPosition('25', pos)).toBe(true);
    expect(stopsTracking(409)).toBe(true);
    expect(stopsTracking(503)).toBe(false);
  });
});
