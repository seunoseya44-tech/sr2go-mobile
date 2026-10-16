import type {
  BoardingFlags,
  DriverPack,
  DriverPackPassenger,
  PackKey,
  PassengerPack,
  SyncAnswer,
  SyncStatus,
  Vehicle,
} from './types';
import { SUPPORT_PHONE_FALLBACK } from './types';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {};
const str = (v: unknown): string | null =>
  typeof v === 'string' && v !== '' ? v : v == null ? null : String(v);
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};

export function parseFlags(v: unknown): BoardingFlags {
  const o = obj(v);
  return {
    driverCheckedPassengerCode: o.driver_checked_passenger_code === true,
    passengerCheckedDriverCode: o.passenger_checked_driver_code === true,
    driverConfirmedFace: o.driver_confirmed_face === true,
    passengerConfirmedFace: o.passenger_confirmed_face === true,
    boarded: o.boarded === true,
    heldForReview: o.held_for_review === true,
  };
}

function parseKey(v: unknown): PackKey {
  const o = obj(v);
  return {
    alg: str(o.alg) ?? 'Ed25519',
    kid: str(o.kid) ?? '',
    publicKey: str(o.public_key) ?? '',
    tokenPrefix: str(o.token_prefix) ?? 'S2G1',
  };
}

function parseVehicle(v: unknown): Vehicle {
  const o = obj(v);
  return {
    make: str(o.make),
    model: str(o.model),
    colour: str(o.colour ?? o.color),
    plate: str(o.plate),
  };
}

export function parsePassengerPack(payload: unknown, clockOffsetSeconds = 0): PassengerPack {
  const s = obj(payload);
  const d = obj(s.driver);
  return {
    bookingId: str(s.booking_id) ?? '',
    rideId: str(s.ride_id) ?? '',
    departureTime: str(s.departure_time),
    expiresAt: str(s.expires_at),
    packVersion: str(s.pack_version) ?? '',
    key: parseKey(s.key),
    myQr: str(s.my_qr) ?? '',
    boardingCode: str(s.boarding_code),
    seatsBooked: num(s.seats_booked),
    driver: {
      userId: str(d.user_id) ?? '',
      name: str(d.name),
      verified: d.verified === true,
      photo: str(d.photo),
      vehicle: parseVehicle(d.vehicle),
    },
    boarding: parseFlags(s.boarding),
    supportPhone: str(s.support_phone) ?? SUPPORT_PHONE_FALLBACK,
    clockOffsetSeconds,
  };
}

function parseDriverPackPassenger(v: unknown): DriverPackPassenger {
  const p = obj(v);
  return {
    bookingId: str(p.booking_id) ?? '',
    passengerId: str(p.passenger_id) ?? '',
    name: str(p.passenger_name),
    verified: p.passenger_verified === true,
    photo: str(p.passenger_photo),
    seatsBooked: num(p.seats_booked),
    children: num(p.children) ?? 0,
    driverCode: str(p.driver_code),
    heldForReview: p.held_for_review === true,
    boarding: parseFlags(p.boarding),
  };
}

export function parseDriverPack(payload: unknown, clockOffsetSeconds = 0): DriverPack {
  const s = obj(payload);
  const list = Array.isArray(s.passengers) ? s.passengers : [];
  return {
    rideId: str(s.ride_id) ?? '',
    departureTime: str(s.departure_time),
    expiresAt: str(s.expires_at),
    packVersion: str(s.pack_version) ?? '',
    key: parseKey(s.key),
    tripQr: str(s.trip_qr) ?? '',
    passengers: list.map(parseDriverPackPassenger),
    supportPhone: str(s.support_phone) ?? SUPPORT_PHONE_FALLBACK,
    clockOffsetSeconds,
  };
}

const STATUSES: SyncStatus[] = ['applied', 'applied_late', 'recorded_late', 'duplicate', 'refused'];

/** POST /api/boarding/sync answers one entry per event, in any envelope. */
export function parseSyncAnswers(payload: unknown): SyncAnswer[] {
  const s = obj(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(s.events)
      ? s.events
      : Array.isArray(s.results)
        ? s.results
        : [];
  return list.map((v) => {
    const o = obj(v);
    const raw = str(o.status ?? o.result) ?? '';
    const status = (STATUSES as string[]).includes(raw) ? (raw as SyncStatus) : 'refused';
    return { eventId: str(o.event_id) ?? '', status, error: str(o.error) };
  });
}
