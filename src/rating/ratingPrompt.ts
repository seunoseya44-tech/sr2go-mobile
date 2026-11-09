/**
 * Martin, 9 Nov 2026: "there should be a way of taking rating from the passenger immediately after the journey by
 * allowing the screen to pop up ... now one must go to My trips to do that, which not everyone has the time for".
 * When the passenger is signed in, and each time the app comes back to the front, ask the server which finished trips
 * he has not rated (GET /api/ratings/to-rate, last APP_SCREENS.RATING_PROMPT_DAYS days) and open "Rate your trip" for
 * the newest - once per trip on this phone (Skip means skip), and never over a payment or an active trip.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

import { ENDPOINTS, http } from '../api/client';
import type { AppStackParamList } from '../navigation/types';
import { shortDate } from '../utils/format';

export interface TripToRate {
  bookingId: string;
  rideId: string;
  driverId: string;
  driverName: string | null;
  origin: string;
  destination: string;
  departureTime: string | null;
}

/** Screens the pop-up must never cover: money being paid, a trip under way, a rating or a report already open. */
export const BUSY_SCREENS = new Set([
  'Payment',
  'BookSeat',
  'PassengerTrip',
  'BoardingPass',
  'RateTrip',
  'ReportProblem',
  'DisputeRoom',
  'WriteReview',
  // release 142: the driver's side - never over boarding, the trip or the photo camera
  'RatePassengers',
  'DriverBoarding',
  'DriverBoardingList',
  'ScanPassenger',
  'EvidenceCamera',
  'ActiveTrip',
]);

/** Pushes after which a trip may now be ready to rate (release 142): checked at once, even with the app open. */
export const RATE_NOW_PUSHES = new Set(['ride_completed']);

export interface RideToRate {
  rideId: string;
  route: string;
}

export function parseRidesToRate(payload: unknown): RideToRate[] {
  const list = Array.isArray(payload) ? (payload as Record<string, unknown>[]) : [];
  return list
    .filter((r) => r && r.ride_id != null && Number(r.passengers_to_rate ?? 0) > 0)
    .map((r) => ({
      rideId: String(r.ride_id),
      route: `${String(r.origin_city ?? '')} → ${String(r.destination_city ?? '')}`,
    }));
}

const KEY = 'sr2go_rating_asked';
const DRIVER_KEY = 'sr2go_rating_asked_rides'; // release 142: rides the driver was offered
const KEEP = 50;
const NUDGE_EVERY_MS = 60_000;

/** Release 142: a screen change asks again, at most once a minute (the driver gets no "trip completed" push). */
let nudge: (() => void) | null = null;
let lastNudge = 0;
export function nudgeRatingPrompt(): void {
  const now = Date.now();
  if (!nudge || now - lastNudge < NUDGE_EVERY_MS) return;
  lastNudge = now;
  nudge();
}

export function parseTripsToRate(payload: unknown): TripToRate[] {
  const list = Array.isArray(payload) ? (payload as Record<string, unknown>[]) : [];
  return list
    .filter((t) => t && t.booking_id != null && t.driver_id != null)
    .map((t) => ({
      bookingId: String(t.booking_id),
      rideId: String(t.ride_id ?? ''),
      driverId: String(t.driver_id),
      driverName: typeof t.driver_name === 'string' ? t.driver_name : null,
      origin: typeof t.origin_city === 'string' ? t.origin_city : '',
      destination: typeof t.destination_city === 'string' ? t.destination_city : '',
      departureTime: typeof t.departure_time === 'string' ? t.departure_time : null,
    }));
}

/** The newest trip not yet offered on this phone. */
export function pickTripToRate(trips: TripToRate[], asked: Set<string>): TripToRate | null {
  return trips.find((t) => !asked.has(t.bookingId)) ?? null;
}

export function rateParams(t: TripToRate): AppStackParamList['RateTrip'] {
  return {
    bookingId: t.bookingId,
    revieweeId: t.driverId,
    name: t.driverName,
    route: `${t.origin} → ${t.destination}${t.departureTime ? ` · ${shortDate(t.departureTime)}` : ''}`,
    rideId: t.rideId || null,
  };
}

async function loadAsked(key: string = KEY): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

async function saveAsked(ids: string[], key: string = KEY): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(ids.slice(-KEEP)));
  } catch {
    // not remembered: at worst the trip is offered once more
  }
}

export function useRatingPrompt(
  signedIn: boolean,
  isPassengerApp: boolean,
  nav: NavigationContainerRefWithCurrent<AppStackParamList>,
): void {
  const running = useRef(false);
  useEffect(() => {
    if (!signedIn || !isPassengerApp) return;
    const check = async () => {
      if (running.current || !nav.isReady()) return;
      const here = nav.getCurrentRoute()?.name;
      if (here && BUSY_SCREENS.has(here)) return;
      running.current = true;
      try {
        const { data } = await http.get(ENDPOINTS.ratingsToRate);
        const asked = await loadAsked();
        const trip = pickTripToRate(parseTripsToRate(data), new Set(asked));
        const busyNow = () => {
          const r = nav.getCurrentRoute()?.name;
          return !nav.isReady() || (!!r && BUSY_SCREENS.has(r));
        };
        if (trip) {
          if (busyNow()) return;
          await saveAsked([...asked, trip.bookingId]);
          nav.navigate('RateTrip', rateParams(trip));
          return;
        }
        // Release 142: the driver's side - "Rate your passengers" opened only after the arrival photo
        const rides = await http
          .get(ENDPOINTS.ratingsPassengersToRate)
          .then((r) => parseRidesToRate(r.data))
          .catch(() => [] as RideToRate[]);
        const askedRides = await loadAsked(DRIVER_KEY);
        const ride = rides.find((r) => !askedRides.includes(r.rideId));
        if (!ride || busyNow()) return;
        await saveAsked([...askedRides, ride.rideId], DRIVER_KEY);
        nav.navigate('RatePassengers', { rideId: ride.rideId });
      } catch {
        // offline or server busy: ask next time the app comes to the front
      } finally {
        running.current = false;
      }
    };
    const first = setTimeout(() => void check(), 1500); // after the first screen has settled
    nudge = () => void check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    // Release 142: the trip ended while the app is open on another screen - ask now, not on the next return
    const pushed = Notifications.addNotificationReceivedListener((n) => {
      const type = String((n.request.content.data ?? {}).type ?? '');
      if (RATE_NOW_PUSHES.has(type)) setTimeout(() => void check(), 1500);
    });
    return () => {
      clearTimeout(first);
      sub.remove();
      pushed.remove();
      nudge = null;
    };
  }, [signedIn, isPassengerApp, nav]);
}
