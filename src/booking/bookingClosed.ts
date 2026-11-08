/**
 * "Booking closed" (Martin, 7 Nov 2026, Ilorin test): a ride that has left, or is too close to departure for the
 * driver to answer, cannot be booked. The SERVER decides when (booking_closes_at on every ride, and the answer
 * 400 `booking_closed` with its own message); the app never computes that time itself.
 */
import type { Place, Ride, RideSearchParams } from '../api/types';
import { isoDate } from '../utils/format';

/** True once the server's booking_closes_at has passed. No time from the server = still open. */
export function bookingClosed(
  ride: Pick<Ride, 'bookingClosesAt'> | null | undefined,
  now = Date.now(),
): boolean {
  if (!ride?.bookingClosesAt) return false;
  const t = Date.parse(ride.bookingClosesAt);
  return Number.isFinite(t) && t <= now;
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** The ride's start or end as a search place (name + map position from the ride itself). */
export function placeOf(
  ride: Ride | null | undefined,
  end: 'origin' | 'destination',
): Place | null {
  if (!ride) return null;
  const lat = num(ride.raw[`${end}_lat`]);
  const lng = num(ride.raw[`${end}_lng`]);
  const name = end === 'origin' ? ride.originCity : ride.destinationCity;
  if (lat == null || lng == null || !name) return null;
  const town = name.split(',')[0]!.trim();
  return { name: town, city: town, lat, lng };
}

/** "Find a later ride": same From, To and seats; the ride's day, or today if that day is already over. */
export function laterRideSearch(
  from: Place | null,
  to: Place | null,
  rideDate: string | null | undefined,
  seats = 1,
  today = isoDate(),
): RideSearchParams | null {
  if (!from || !to) return null;
  const day = rideDate && /^\d{4}-\d{2}-\d{2}/.test(rideDate) ? rideDate.slice(0, 10) : today;
  return { origin: from, destination: to, date: day < today ? today : day, seats };
}
