/**
 * Trip-day calls (30 Sep update + Build Brief §F/G/J): Depart/Arrived
 * evidence, journey record, passenger tracking, plate photo, strikes.
 */
import { ENDPOINTS, http } from './client';
import { unwrap, unwrapList } from './parsers';

type Json = Record<string, unknown>;
const obj = (v: unknown): Json =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {};
const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null;
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const first = (s: Json, keys: string[]) => {
  for (const k of keys) {
    const v = str(s[k]);
    if (v) return v;
  }
  return null;
};

export type EvidenceEvent = 'journey_start' | 'journey_complete';

export interface EvidenceResult {
  address: string | null;
  distanceKm: number | null;
  withinRadius: boolean | null;
  photoStored: boolean;
  flags: string[];
}

export interface JourneyPoint {
  address: string | null;
  time: string | null;
  distanceKm: number | null;
  withinRadius: boolean | null;
  lat: number | null;
  lng: number | null;
}

export interface JourneyRecord {
  allClear: boolean;
  departed: JourneyPoint | null;
  arrived: JourneyPoint | null;
  flags: string[];
  notes: string | null;
}

function parsePoint(v: unknown): JourneyPoint | null {
  const p = obj(v);
  if (!Object.keys(p).length || p.recorded === false) return null;
  return {
    address: first(p, ['address']),
    time: first(p, ['time', 'device_time', 'recorded_at', 'created_at']),
    distanceKm: num(p.distance_km),
    withinRadius: typeof p.within_radius === 'boolean' ? p.within_radius : null,
    lat: num(p.latitude ?? p.lat),
    lng: num(p.longitude ?? p.lng),
  };
}

const flagsOf = (v: unknown): string[] =>
  Array.isArray(v)
    ? v
        .map((f) => (typeof f === 'string' ? f : first(obj(f), ['message', 'text', 'label'])))
        .filter((f): f is string => !!f)
    : [];

export interface TrackPosition {
  lat: number | null;
  lng: number | null;
  lastUpdated: string | null;
  status: string | null;
  message: string | null;
}

export interface Strike {
  id: string;
  reason: string | null;
  date: string | null;
  status: string | null;
}

export const tripApi = {
  /** POST /api/rides/{id}/evidence. No network or camera failure: the record goes without a photo. */
  async evidence(
    rideId: string,
    p: {
      event: EvidenceEvent;
      latitude: number | null;
      longitude: number | null;
      accuracyM: number | null;
      photoBase64: string | null;
    },
  ): Promise<EvidenceResult> {
    const { data } = await http.post(ENDPOINTS.rideEvidence(rideId), {
      event_type: p.event,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy_m: p.accuracyM,
      device_time: new Date().toISOString(),
      ...(p.photoBase64 ? { photo_base64: p.photoBase64 } : {}),
    });
    const s = unwrap(data);
    return {
      address: first(s, ['address']),
      distanceKm: num(s.distance_km),
      withinRadius: typeof s.within_radius === 'boolean' ? s.within_radius : null,
      photoStored: s.photo_stored === true,
      flags: flagsOf(s.flags),
    };
  },

  /** GET /api/rides/{id}/journey-record. Never carries a photo. */
  async journeyRecord(rideId: string): Promise<JourneyRecord> {
    const { data } = await http.get(ENDPOINTS.journeyRecord(rideId));
    const s = unwrap(data);
    return {
      allClear: s.all_clear === true,
      departed: parsePoint(s.departure ?? s.departed ?? s.journey_start ?? s.start),
      arrived: parsePoint(s.arrival ?? s.arrived ?? s.journey_complete ?? s.end),
      flags: flagsOf(s.flags ?? s.notes),
      notes: typeof s.notes === 'string' ? s.notes : null,
    };
  },

  /** GET /api/rides/track/{token} (no login): the car's last position while the trip is active. */
  async track(token: string): Promise<TrackPosition> {
    const { data } = await http.get(ENDPOINTS.track(token), { skipSessionHandling: true });
    const s = unwrap(data);
    return {
      lat: num(s.current_lat),
      lng: num(s.current_lng),
      lastUpdated: first(s, ['last_updated']),
      status: first(s, ['status', 'ride_status']),
      message: first(s, ['message']),
    };
  },

  /** POST /api/rides/bookings/{id}/verify-vehicle: the passenger's plate photo. */
  async plantePhoto(
    bookingId: string,
    p: {
      photoBase64: string;
      latitude: number | null;
      longitude: number | null;
      accuracyM: number | null;
    },
  ): Promise<string | null> {
    const { data } = await http.post(ENDPOINTS.verifyVehicle(bookingId), {
      booking_id: bookingId,
      photo_base64: p.photoBase64,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy_m: p.accuracyM,
    });
    return first(unwrap(data), ['message']);
  },

  async strikes(): Promise<{ count: number | null; items: Strike[]; message: string | null }> {
    const { data } = await http.get(ENDPOINTS.escrowStrikes);
    const s = unwrap(data);
    const items = unwrapList(data, ['strikes', 'items', 'results']).map((v, i) => {
      const x = obj(v);
      return {
        id: first(x, ['id']) ?? String(i),
        reason: first(x, ['reason', 'description', 'type']),
        date: first(x, ['created_at', 'date']),
        status: first(x, ['status']),
      };
    });
    return {
      count: num(s.total_strikes ?? s.count ?? s.strikes_count ?? s.total) ?? items.length,
      items,
      message:
        first(s, ['message', 'note']) ??
        (s.is_suspended === true
          ? `Suspended until ${first(s, ['suspended_until']) ?? '—'}`
          : null),
    };
  },
};
