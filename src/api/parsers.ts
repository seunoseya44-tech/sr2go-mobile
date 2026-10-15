import { ApiError } from './errors';
import type { AuthTokens, DriverPublicProfile, Preference, Ride, TickerRoute, User } from './types';

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function str(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  return null;
}

function numeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

/** Money stays a string (never rounded by the app); numbers are stringified as-is. */
function money(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function firstString(source: Json, keys: string[]): string | null {
  for (const key of keys) {
    const value = str(source[key]);
    if (value) return value;
  }
  return null;
}

function readBoolean(source: Json, keys: string[]): boolean | null {
  for (const key of keys) {
    if (typeof source[key] === 'boolean') return source[key] as boolean;
  }
  return null;
}

function preference(value: unknown): Preference {
  if (value === 'yes' || value === 'no' || value === 'ask') return value;
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return null;
}

/** Many APIs wrap payloads in `{ data: {...} }`; accept both shapes. */
export function unwrap(payload: unknown): Json {
  if (!isObject(payload)) return {};
  return isObject(payload.data) ? { ...payload, ...payload.data } : payload;
}

/** Finds the list in `{ rides: [...] }`, `{ results: [...] }`, `{ data: [...] }` or a bare array. */
export function unwrapList(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isObject(payload)) return [];
  for (const key of [...keys, 'items', 'results', 'data']) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

/**
 * Reads the token pair from a login/refresh response. Tolerant of the common
 * naming conventions (`access_token`, `token`, `accessToken`) so a harmless
 * backend rename doesn't break sign-in.
 */
export function parseTokens(payload: unknown): AuthTokens {
  const body = unwrap(payload);
  const accessToken = firstString(body, ['access_token', 'accessToken', 'token', 'jwt']);
  if (!accessToken) {
    throw new ApiError('unknown', 'Sign-in succeeded but no access token was returned.');
  }
  return {
    accessToken,
    refreshToken: firstString(body, ['refresh_token', 'refreshToken']),
    tokenType: firstString(body, ['token_type', 'tokenType']) ?? 'bearer',
  };
}

export function parseUser(payload: unknown): User | null {
  const body = unwrap(payload);
  const source = isObject(body.user) ? body.user : body;

  const first = firstString(source, ['first_name', 'firstName']);
  const last = firstString(source, ['last_name', 'lastName', 'surname']);
  const joined = [first, last].filter(Boolean).join(' ') || null;

  const user: User = {
    id: firstString(source, ['id', 'user_id', 'uuid', '_id']),
    email: firstString(source, ['email', 'email_address']),
    fullName: firstString(source, ['full_name', 'fullName', 'name']) ?? joined,
    phone: firstString(source, ['phone', 'phone_number', 'phoneNumber']),
    role: firstString(source, ['role', 'user_type', 'userType', 'account_type']),
    phoneVerified: readBoolean(source, ['phone_verified', 'phoneVerified']),
    isVerified: readBoolean(source, ['is_verified', 'identity_verified', 'kyc_complete']),
    ninVerified: readBoolean(source, ['nin_verified']),
    bankVerified: readBoolean(source, ['bank_verified']),
    raw: source,
  };

  // A body with none of the identifying fields isn't a user object.
  return user.id || user.email || user.fullName ? user : null;
}

/** Splits "2026-10-03T07:30:00" into date and HH:MM; accepts separate fields too. */
function readDeparture(source: Json): { date: string | null; time: string | null } {
  const combined = firstString(source, ['departure_time', 'departure_at', 'departs_at']);
  const dateField = firstString(source, ['departure_date']);
  if (combined && combined.includes('T')) {
    const [date, rest] = combined.split('T');
    return { date: date ?? null, time: rest ? rest.slice(0, 5) : null };
  }
  if (combined && /^\d{1,2}:\d{2}/.test(combined)) {
    return { date: dateField, time: combined.slice(0, 5) };
  }
  return { date: dateField ?? combined, time: null };
}

/** Null on city trips, or when the anchor equals the price / savings are 0. */
function usualFareOf(s: Json): string | null {
  const anchor = money(s.usual_fare);
  const price = money(s.pay_amount) ?? money(s.display_price) ?? money(s.price_per_seat);
  const pct = numeric(s.savings_pct);
  if (!anchor || anchor === price || (pct != null && pct <= 0)) return null;
  return anchor;
}

function savingsPctOf(s: Json): number | null {
  const pct = numeric(s.savings_pct);
  return pct != null && pct > 0 && usualFareOf(s) ? pct : null;
}

export function parseRide(payload: unknown): Ride | null {
  const s = unwrap(payload);
  const id = firstString(s, ['id', 'ride_id']);
  if (!id) return null;
  const { date, time } = readDeparture(s);
  const driver = isObject(s.driver) ? s.driver : {};

  return {
    id,
    departureDate: date,
    departureTime: time,
    originCity: firstString(s, ['origin_city', 'origin', 'from_city']),
    destinationCity: firstString(s, ['destination_city', 'destination', 'to_city']),
    vehicleType: firstString(s, ['vehicle_type']),
    seatsLeft: numeric(s.seats_left ?? s.seats_available),
    meetingPointName: firstString(s, ['meeting_point_name']),
    meetingPointAddress: firstString(s, ['meeting_point_address']),
    meetingPointLat: numeric(s.meeting_point_lat),
    meetingPointLng: numeric(s.meeting_point_lng),
    driverId: firstString(s, ['driver_id']) ?? firstString(driver, ['id']),
    driverName: firstString(s, ['driver_name']) ?? firstString(driver, ['name', 'full_name']),
    driverRating: numeric(s.driver_rating ?? driver.rating),
    driverTripsCompleted: numeric(
      s.driver_trips ?? s.driver_rides_completed ?? driver.rides_completed,
    ),
    driverVerified:
      s.driver_verified === true || driver.verified === true || driver.is_verified === true,
    // display_price on older screens equals pay_amount; prefer pay_amount.
    payAmount: money(s.pay_amount) ?? money(s.display_price) ?? money(s.price_per_seat),
    usualFare: usualFareOf(s),
    savingsPct: savingsPctOf(s),
    autoApprove: s.auto_approve === true,
    isAc: s.is_ac === true,
    driverSmokes: s.driver_smokes === true,
    prefMusic: preference(s.pref_music),
    prefPets: preference(s.pref_pets),
    prefChat: preference(s.pref_chat),
    prefSmoking: preference(s.pref_smoking),
    maxLuggageKg: numeric(s.max_luggage_kg),
    luggageNote: firstString(s, ['luggage_note']),
    notes: firstString(s, ['notes', 'driver_notes']),
    raw: s,
  };
}

export function parseRides(payload: unknown): Ride[] {
  return unwrapList(payload, ['rides'])
    .map(parseRide)
    .filter((r): r is Ride => r !== null);
}

export function parseDriverProfile(payload: unknown): DriverPublicProfile {
  const s = unwrap(payload);
  const vehicle = isObject(s.vehicle) ? s.vehicle : s;
  const parts = [
    firstString(vehicle, ['vehicle_make', 'make']),
    firstString(vehicle, ['vehicle_model', 'model']),
    firstString(vehicle, ['vehicle_year', 'year']),
  ].filter(Boolean);
  const colour = firstString(vehicle, ['vehicle_color', 'vehicle_colour', 'color', 'colour']);
  const badges = Array.isArray(s.badges) ? s.badges.map(str).filter((b): b is string => !!b) : [];

  return {
    id: firstString(s, ['id', 'driver_id', 'user_id']),
    name: firstString(s, ['name', 'driver_name', 'full_name']),
    memberSince: firstString(s, ['member_since', 'created_at', 'joined_at']),
    rating: numeric(s.rating ?? s.driver_rating ?? s.average_rating),
    tripsCompleted: numeric(s.rides_completed ?? s.trips_completed ?? s.total_rides),
    isVerified: s.is_verified === true || s.identity_verified === true,
    badges,
    vehicle: parts.length ? `${parts.join(' ')}${colour ? ` · ${colour}` : ''}` : null,
    raw: s,
  };
}

export function parseTicker(payload: unknown): TickerRoute[] {
  return unwrapList(payload, ['routes', 'ticker'])
    .map((item) => {
      if (!isObject(item)) return null;
      const origin = firstString(item, ['origin', 'origin_city', 'from']);
      const destination = firstString(item, ['destination', 'destination_city', 'to']);
      const price = money(item.price ?? item.pay_amount ?? item.display_price);
      if (!origin || !destination || !price) return null;
      // City routes come back with the anchor equal to the price and 0% savings;
      // the rule is to show the price only, so drop both in that case.
      const anchor = money(item.motor_park_anchor ?? item.usual_fare);
      const pct = numeric(item.savings_pct);
      const hasSaving = !!anchor && anchor !== price && (pct == null || pct > 0);
      return {
        origin,
        destination,
        price,
        motorParkAnchor: hasSaving ? anchor : null,
        savingsPct: hasSaving && pct != null && pct > 0 ? pct : null,
      } satisfies TickerRoute;
    })
    .filter((r): r is TickerRoute => r !== null);
}
