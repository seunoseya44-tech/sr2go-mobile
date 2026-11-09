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
]);

const KEY = 'sr2go_rating_asked';
const KEEP = 50;

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

async function loadAsked(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

async function saveAsked(ids: string[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(ids.slice(-KEEP)));
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
        if (!trip || !nav.isReady()) return;
        const now = nav.getCurrentRoute()?.name;
        if (now && BUSY_SCREENS.has(now)) return;
        await saveAsked([...asked, trip.bookingId]);
        nav.navigate('RateTrip', rateParams(trip));
      } catch {
        // offline or server busy: ask next time the app comes to the front
      } finally {
        running.current = false;
      }
    };
    const first = setTimeout(() => void check(), 1500); // after the first screen has settled
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => {
      clearTimeout(first);
      sub.remove();
    };
  }, [signedIn, isPassengerApp, nav]);
}
