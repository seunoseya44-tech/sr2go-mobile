/**
 * Breakdown and rescue (first sent 2 Oct; build sheet in Ifeanyi's API
 * reference, section 2). The driver files a breakdown; each stranded
 * passenger picks a rescue ride or makes their own way; money lines come
 * from the server as sent, only the passenger's own.
 */
import { ENDPOINTS, http } from './client';
import { unwrap, unwrapList } from './parsers';

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const str = (v: unknown): string | null =>
  typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : null;
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))
      ? Number(v)
      : null;
const first = (s: Json, keys: string[]) => {
  for (const k of keys) {
    const v = str(s[k]);
    if (v) return v;
  }
  return null;
};

export interface RescueRequestLine {
  id: string;
  passengerName: string | null;
  status: string | null;
}

export interface Breakdown {
  id: string;
  status: string | null;
  address: string | null;
  strandedCount: number | null;
  requests: RescueRequestLine[];
  message: string | null;
}

export interface RescueCandidate {
  rideId: string;
  driverName: string | null;
  driverRating: number | null;
  departureTime: string | null;
  pricePerSeat: string | null;
  seatsLeft: number | null;
  topUp: string | null;
  credit: string | null;
}

export interface RescueRequest {
  id: string;
  status: string | null;
  strandedAt: string | null;
  destination: string | null;
  note: string | null;
  candidates: RescueCandidate[];
  bookedRideId: string | null;
}

export interface RescueAnswer {
  message: string | null;
  note: string | null;
  topUpPaymentUrl: string | null;
}

export function parseBreakdown(payload: unknown): Breakdown {
  const s = unwrap(payload);
  return {
    id: first(s, ['breakdown_id', 'id']) ?? '',
    status: first(s, ['status']),
    address: first(s, ['breakdown_address', 'address']),
    strandedCount: num(s.stranded_passenger_count),
    requests: unwrapList(s, ['rescue_requests'])
      .map((v) => {
        const r = obj(v);
        const id = first(r, ['rescue_request_id', 'id']);
        return id
          ? {
              id,
              passengerName: first(r, ['passenger_name', 'name']),
              status: first(r, ['status']),
            }
          : null;
      })
      .filter((r): r is RescueRequestLine => !!r),
    message: first(s, ['message']),
  };
}

export function parseRescue(payload: unknown): RescueRequest {
  const s = unwrap(payload);
  const stranded = obj(s.stranded_at);
  const dest = obj(s.destination);
  const rec = obj(s.reconciliation);
  return {
    id: first(s, ['rescue_request_id', 'id']) ?? '',
    status: first(s, ['status']),
    strandedAt: first(stranded, ['address', 'name']) ?? str(s.stranded_at),
    destination: first(dest, ['address', 'name']) ?? str(s.destination),
    note: first(rec, ['breakdown_note']),
    bookedRideId: first(s, ['rescue_ride_id', 'booked_rescue_ride_id']),
    candidates: unwrapList(s, ['rescue_candidates'])
      .map((v) => {
        const c = obj(v);
        const rideId = first(c, ['rescue_ride_id', 'ride_id', 'id']);
        if (!rideId) return null;
        return {
          rideId,
          driverName: first(c, ['driver_name']),
          driverRating: num(c.driver_rating),
          departureTime: first(c, ['departure_time']),
          pricePerSeat: first(c, ['price_per_seat']),
          seatsLeft: num(c.seats_left),
          topUp: first(c, ['passenger_top_up']),
          credit: first(c, ['passenger_credit']),
        };
      })
      .filter((c): c is RescueCandidate => !!c),
  };
}

function answer(payload: unknown): RescueAnswer {
  const s = unwrap(payload);
  const rec = obj(s.reconciliation);
  return {
    message: first(s, ['message']),
    note:
      first(rec, ['settlement_note', 'refund_note', 'breakdown_note']) ?? first(s, ['refund_note']),
    topUpPaymentUrl: first(s, ['top_up_payment_url']),
  };
}

export const breakdownApi = {
  /** Row 1. */
  async file(p: {
    rideId: string;
    lat: number;
    lng: number;
    address?: string | null;
    notes?: string;
  }) {
    const { data } = await http.post(ENDPOINTS.breakdownFile, {
      ride_id: Number(p.rideId),
      breakdown_lat: p.lat,
      breakdown_lng: p.lng,
      breakdown_address: p.address ?? null,
      notes: p.notes || null,
    });
    return parseBreakdown(data);
  },
  /** Rows 2 and 3. */
  async get(breakdownId: string) {
    const { data } = await http.get(ENDPOINTS.breakdown(breakdownId));
    return parseBreakdown(data);
  },
  /** Row 4. */
  async rescue(rescueId: string) {
    const { data } = await http.get(ENDPOINTS.rescue(rescueId));
    return parseRescue(data);
  },
  /** Row 5. */
  async book(rescueId: string, rideId: string) {
    const { data } = await http.post(ENDPOINTS.rescueBook(rescueId, rideId));
    return answer(data);
  },
  /** Row 6. */
  async abandon(rescueId: string) {
    const { data } = await http.post(ENDPOINTS.rescueAbandon(rescueId));
    return answer(data);
  },
  /** Row 7. */
  async complete(rescueId: string) {
    const { data } = await http.post(ENDPOINTS.rescueComplete(rescueId));
    return answer(data);
  },
};

/** The ride has started (or finished): no more "I'll make my own way". */
export function rescueStarted(status: string | null): boolean {
  return !!status && /(started|in_progress|on_the_way|active|completed|arrived)/i.test(status);
}
