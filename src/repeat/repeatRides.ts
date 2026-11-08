/**
 * Repeat rides (Martin, 8 Nov 2026): "for those who run a particular route all the time - Monday to Friday, or every
 * Monday - instead of coming every day to schedule a ride". The driver saves the ride once with its days; SR2Go posts
 * each ride a week ahead through the usual checks (server release 138, /api/ride-schedules).
 * Days are 0 Monday .. 6 Sunday, as the server counts them.
 */
import { ENDPOINTS, http } from '../api/client';
import { unwrapList } from '../api/parsers';

export const DAY_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MON_FRI = [0, 1, 2, 3, 4];
export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** Tap a day on or off; the list stays sorted and without repeats. */
export function toggleDay(days: number[], day: number): number[] {
  const set = new Set(days);
  if (set.has(day)) set.delete(day);
  else set.add(day);
  return [...set].sort((a, b) => a - b);
}

/** "Monday to Friday", "Every day", "Monday", "Monday, Wednesday" - what the driver reads. */
export function daysText(days: number[]): string {
  const d = [...new Set(days)].sort((a, b) => a - b);
  if (d.length === 0) return 'No days chosen';
  if (d.length === 7) return 'Every day';
  if (d.join(',') === MON_FRI.join(',')) return 'Monday to Friday';
  if (d.length === 1) return `Every ${DAY_NAMES[d[0] ?? 0] ?? ''}`;
  return d.map((x) => DAY_NAMES[x]).join(', ');
}

/** The weekday (0 Monday) of a YYYY-MM-DD date. */
export function weekdayOf(isoDay: string): number {
  const [y = 0, m = 1, d = 1] = isoDay.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

export interface RepeatNextRide {
  rideId: string;
  departureTime: string;
  seatsLeft: number | null;
  seatsBooked: number;
}

export interface RepeatRide {
  id: string;
  status: 'active' | 'paused' | 'stopped' | 'ended';
  pauseMessage: string | null;
  days: number[];
  daysText: string;
  time: string;
  endDate: string | null;
  origin: string;
  destination: string;
  seats: number | null;
  takeHomePerSeat: string | null;
  nextRides: RepeatNextRide[];
}

type Json = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
const num = (v: unknown) =>
  typeof v === 'number' ? v : v === null || v === undefined || v === '' ? null : Number(v);

export function parseRepeatRide(payload: unknown): RepeatRide | null {
  const s = (payload ?? {}) as Json;
  if (s.id === undefined || s.id === null) return null;
  const status = String(s.status ?? 'active');
  const days = Array.isArray(s.days)
    ? (s.days as unknown[]).map(Number).filter((n) => n >= 0 && n <= 6)
    : [];
  return {
    id: String(s.id),
    status: (['active', 'paused', 'stopped', 'ended'].includes(status)
      ? status
      : 'active') as RepeatRide['status'],
    pauseMessage: str(s.pause_message),
    days,
    daysText: str(s.days_text) ?? daysText(days),
    time: str(s.local_time) ?? '',
    endDate: str(s.end_date),
    origin: str(s.origin_address) ?? '',
    destination: str(s.destination_address) ?? '',
    seats: num(s.total_seats),
    takeHomePerSeat: str(s.price_per_seat),
    nextRides: (Array.isArray(s.next_rides) ? (s.next_rides as Json[]) : []).map((r) => ({
      rideId: String(r.ride_id),
      departureTime: String(r.departure_time ?? ''),
      seatsLeft: num(r.seats_left),
      seatsBooked: num(r.seats_booked) ?? 0,
    })),
  };
}

export const repeatRidesApi = {
  async mine(): Promise<RepeatRide[]> {
    const { data } = await http.get(ENDPOINTS.rideSchedulesMine);
    return unwrapList(data, ['items', 'results'])
      .map(parseRepeatRide)
      .filter((r): r is RepeatRide => !!r);
  },
  async act(id: string, action: 'pause' | 'resume' | 'stop'): Promise<void> {
    await http.post(ENDPOINTS.rideScheduleAction(id, action));
  },
};
