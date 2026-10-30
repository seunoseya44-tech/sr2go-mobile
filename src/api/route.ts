/**
 * The ride's road route from the server (GET /api/rides/{ride_id}/route,
 * 30 Oct). The server picks the routing service (Google in the South, OSRM in
 * the North) and the app only draws what comes back: it never calculates a
 * distance, a time or a line of its own.
 */
import { ENDPOINTS, http } from './client';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RideRoute {
  distanceKm: number | null;
  durationMin: number | null;
  /** Road line; null when the route service did not answer (then the figures are estimates). */
  line: LatLng[] | null;
  /** True when the server fell back to a straight-line estimate ("haversine_fallback"). */
  estimate: boolean;
  origin: { address: string | null; lat: number | null; lng: number | null };
  destination: { address: string | null; lat: number | null; lng: number | null };
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const num = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))
      ? Number(v)
      : null;
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

const end = (v: unknown) => {
  const o = obj(v);
  return { address: str(o.address) ?? str(o.name), lat: num(o.lat), lng: num(o.lng) };
};

export function parseRideRoute(payload: unknown): RideRoute {
  const s = obj(payload);
  const g = obj(s.geometry);
  const coords = Array.isArray(g.coordinates) ? g.coordinates : null;
  // GeoJSON order is [lng, lat].
  const line = coords
    ? coords
        .map((c) => (Array.isArray(c) ? { longitude: num(c[0]), latitude: num(c[1]) } : null))
        .filter((p): p is LatLng => !!p && p.latitude != null && p.longitude != null)
    : null;
  return {
    distanceKm: num(s.distance_km),
    durationMin: num(s.duration_min),
    line: line && line.length > 1 ? line : null,
    estimate: str(s.source) === 'haversine_fallback' || !line || line.length < 2,
    origin: end(s.origin),
    destination: end(s.destination),
  };
}

export const routeApi = {
  async get(rideId: string): Promise<RideRoute> {
    const { data } = await http.get(ENDPOINTS.rideRoute(rideId), { skipSessionHandling: true });
    return parseRideRoute(data);
  },
};

/** "302 km · about 4 h 50 min" exactly from the server's figures. */
export function routeSummary(r: RideRoute | null | undefined): string | null {
  if (!r || r.distanceKm == null) return null;
  const km = `${Math.round(r.distanceKm)} km`;
  let time = '';
  if (r.durationMin != null) {
    const h = Math.floor(r.durationMin / 60);
    const m = Math.round(r.durationMin % 60);
    time = h > 0 ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
  }
  const head = r.estimate ? 'about ' : '';
  return time ? `${head}${km} · ${r.estimate ? 'about ' : ''}${time} by road` : `${head}${km}`;
}
