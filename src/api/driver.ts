/**
 * Driver mode (Build Brief §J, DR3, 13 Oct "Your car" field, 16 Oct
 * publishing answers). The driver only ever sees their own take-home and the
 * three lines the backend returns for a price; never the passenger split.
 */
import { ENDPOINTS, http } from './client';
import { parseRide, parseRides, unwrap, unwrapList } from './parsers';
import type { Preference, Ride } from './types';

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

/* ---------- vehicle profile ---------- */

export type DriverApproval = 'none' | 'pending' | 'approved' | 'rejected';

export interface DriverProfile {
  approval: DriverApproval;
  vehicle: string | null;
  plate: string | null;
  seats: number | null;
  message: string | null;
  /** Make and model only ("Toyota Camry"), used to fill "Your car" when posting. */
  makeModel: string | null;
  raw: Json;
}

export function parseDriverProfileMe(payload: unknown): DriverProfile {
  const s = unwrap(payload);
  const parts = [
    first(s, ['vehicle_color', 'vehicle_colour']),
    first(s, ['vehicle_make']),
    first(s, ['vehicle_model']),
  ].filter(Boolean);
  const status = (first(s, ['status', 'approval_status', 'review_status']) ?? '').toLowerCase();
  let approval: DriverApproval = 'pending';
  if (s.is_approved === true || status === 'approved') approval = 'approved';
  else if (status === 'rejected' || status === 'not_approved' || s.is_rejected === true)
    approval = 'rejected';
  return {
    approval,
    vehicle: parts.length ? parts.join(' ') : first(s, ['vehicle']),
    plate: first(s, ['plate_number', 'plate']),
    seats: num(s.seats_available),
    message: first(s, ['message']),
    makeModel:
      [first(s, ['vehicle_make']), first(s, ['vehicle_model'])].filter(Boolean).join(' ') || null,
    raw: s,
  };
}

export interface VehiclePayload {
  make: string;
  model: string;
  year: string;
  colour: string;
  licence: string;
  plate: string;
  seats: number;
  plateColour: 'Blue' | 'Yellow' | 'Red' | 'Green' | 'Other';
  declaration: boolean;
}

/* ---------- post a ride ---------- */

export interface MeetingPoint {
  name: string;
  type: string | null;
  address: string | null;
  distanceM: number | null;
  lat: number | null;
  lng: number | null;
}

export function parseMeetingPoints(payload: unknown): MeetingPoint[] {
  return unwrapList(payload, ['meeting_points', 'items', 'results'])
    .map((v) => {
      const m = obj(v);
      const name = first(m, ['name', 'label']);
      return name
        ? {
            name,
            type: first(m, ['type']),
            address: first(m, ['address']),
            distanceM: num(m.distance_m),
            lat: num(m.lat),
            lng: num(m.lon ?? m.lng),
          }
        : null;
    })
    .filter((m): m is MeetingPoint => !!m);
}

export interface RouteInput {
  originLat: number;
  originLng: number;
  originCity: string;
  destLat: number;
  destLng: number;
  destCity: string;
}

export interface PriceSuggestion {
  /** What the driver takes home per seat (driver_gets). */
  suggested: string | null;
  passengerPays: string | null;
  serviceFee: string | null;
  message: string | null;
}

export type WarningLevel = 'GOOD' | 'LOW' | 'HIGH' | 'BELOW_FLOOR' | 'ABOVE_MARKET' | 'UNKNOWN';

export interface PriceCheck {
  level: WarningLevel;
  driverMessage: string | null;
  responsibilityNotice: string | null;
  requiresAck: boolean;
  /** The three lines, exactly as returned (10 Oct rule). */
  lines: string[];
}

/** "You receive / Fees / Passenger pays" from a `breakdown {take_home, fees, passenger_pays}`. */
export function breakdownLines(bd: Record<string, unknown>): string[] {
  const money = (v: unknown) => (num(v) != null ? `₦${num(v)!.toLocaleString('en-NG')}` : null);
  const out: string[] = [];
  if (money(bd.take_home)) out.push(`You receive ${money(bd.take_home)}`);
  if (money(bd.fees)) out.push(`Fees ${money(bd.fees)}`);
  if (money(bd.passenger_pays)) out.push(`Passenger pays ${money(bd.passenger_pays)}`);
  return out;
}

export function parsePriceCheck(payload: unknown): PriceCheck {
  const s = unwrap(payload);
  const raw = (first(s, ['warning_level', 'level', 'status']) ?? 'UNKNOWN').toUpperCase();
  const level = (
    ['GOOD', 'LOW', 'HIGH', 'BELOW_FLOOR', 'ABOVE_MARKET', 'UNKNOWN'] as string[]
  ).includes(raw)
    ? (raw as WarningLevel)
    : 'UNKNOWN';
  const linesRaw = s.lines ?? s.breakdown_lines ?? s.price_lines;
  const driverPrice = num(s.driver_price);
  const suggestedGets = num(s.suggested_driver_gets);
  const suggestedPays = num(s.suggested_price);
  const composed: string[] = [];
  const bd = obj(s.breakdown);
  if (Object.keys(bd).length) {
    composed.push(...breakdownLines(bd));
  } else if (driverPrice != null) {
    composed.push(`You receive ₦${driverPrice.toLocaleString('en-NG')} per seat`);
    if (suggestedGets != null && suggestedPays != null && driverPrice === suggestedGets) {
      composed.push(
        `SR2Go service fee ₦${(suggestedPays - suggestedGets).toLocaleString('en-NG')}`,
      );
      composed.push(`Passenger pays ₦${suggestedPays.toLocaleString('en-NG')}`);
    }
  }
  const lines = Array.isArray(linesRaw)
    ? linesRaw.map(str).filter((l): l is string => !!l)
    : composed.length
      ? composed
      : [
          first(s, ['take_home_line']),
          first(s, ['service_fee_line']),
          first(s, ['passenger_pays_line']),
        ].filter((l): l is string => !!l);
  return {
    level,
    driverMessage: first(s, ['driver_message', 'message']),
    responsibilityNotice: first(s, ['responsibility_notice']),
    requiresAck: s.requires_ack === true,
    lines,
  };
}

export interface PostRidePayload {
  route: RouteInput;
  originName: string;
  destName: string;
  /** YYYY-MM-DD and HH:MM */
  date: string;
  time: string;
  seats: number;
  /** 13 Oct: free text "Your car" replaces the vehicle chooser. */
  car: string;
  meetingPoint: { name: string; address: string | null; lat: number | null; lng: number | null };
  driverPrice: string;
  priceAcknowledged: boolean;
  autoApprove: boolean;
  isAc: boolean;
  prefMusic: Preference;
  prefPets: Preference;
  prefChat: Preference;
  prefSmoking: Preference;
  driverSmokes: boolean;
  maxLuggageKg: number | null;
  luggageNote: string;
  notes: string;
}

/* ---------- my rides, requests, boarding ---------- */

export interface DriverRide extends Ride {
  takeHomePerSeat: string | null;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled' | 'unknown';
  seatsTotal: number | null;
  seatsBooked: number | null;
  requestsPending: number | null;
  /** Release 103: the three price lines from `breakdown`. */
  priceLines: string[];
}

export function parseDriverRide(payload: unknown): DriverRide | null {
  const ride = parseRide(payload);
  if (!ride) return null;
  const s = unwrap(payload);
  const raw = (first(s, ['status', 'ride_status']) ?? '').toLowerCase();
  const total = num(s.seats_available ?? s.seats_total ?? s.total_seats);
  const left = ride.seatsLeft;
  return {
    ...ride,
    takeHomePerSeat: first(s, ['driver_take_home_per_seat', 'take_home_per_seat', 'driver_price']),
    status: (['scheduled', 'active', 'completed', 'cancelled'] as string[]).includes(raw)
      ? (raw as DriverRide['status'])
      : 'unknown',
    seatsTotal: total,
    seatsBooked: num(s.seats_booked) ?? (total != null && left != null ? total - left : null),
    requestsPending: num(s.pending_requests ?? s.requests_pending),
    priceLines: breakdownLines(obj(s.breakdown)),
  };
}

export interface RideBooking {
  id: string;
  passengerId: string | null;
  connecting: boolean;
  passengerName: string | null;
  passengerVerified: boolean;
  passengerRating: number | null;
  passengerPhone: string | null;
  seats: number;
  children: number;
  frontSeatPreferred: boolean;
  note: string | null;
  luggageKg: number | null;
  luggageDescription: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed' | 'unknown';
  paid: boolean;
  boarded: boolean;
  heldForReview: boolean;
  message: string | null;
  /** Release 103: the booker's booking id when this seat was added as "travelling with". */
  travellingWith: string | null;
}

export function parseRideBookings(payload: unknown): RideBooking[] {
  return unwrapList(payload, ['bookings', 'items', 'results'])
    .map((v) => {
      const b = obj(v);
      const id = first(b, ['id', 'booking_id']);
      if (!id) return null;
      const raw = (first(b, ['status']) ?? '').toLowerCase();
      const flags = obj(b.boarding);
      return {
        id,
        passengerId: first(b, ['passenger_id', 'user_id']),
        connecting: !!first(b, ['connection_id']) || b.is_connecting === true,
        passengerName: first(b, ['passenger_name', 'name']),
        passengerVerified: b.passenger_verified === true || b.verified === true,
        passengerRating: num(b.passenger_rating ?? b.rating),
        passengerPhone: first(b, ['passenger_phone']),
        seats: num(b.seats_booked) ?? 1,
        children: num(b.children) ?? 0,
        frontSeatPreferred: b.front_seat_preferred === true,
        note: first(b, ['pickup_note', 'note']),
        luggageKg: num(b.luggage_kg),
        luggageDescription: first(b, ['luggage_description']),
        status: (
          ['pending', 'accepted', 'rejected', 'cancelled', 'completed'] as string[]
        ).includes(raw)
          ? (raw as RideBooking['status'])
          : 'unknown',
        paid: b.payment_status === 'paid',
        boarded: b.boarded === true || flags.boarded === true,
        heldForReview: b.held_for_review === true || flags.held_for_review === true,
        message: first(b, ['message']),
        travellingWith: first(b, ['travelling_with']),
      };
    })
    .filter((b): b is RideBooking => !!b);
}

export interface BoardingCheck {
  passengerName: string | null;
  passengerPhoto: string | null;
  seats: number | null;
  children: number;
  bookingId: string | null;
  message: string | null;
}

export function parseBoardingCheck(payload: unknown): BoardingCheck {
  const s = unwrap(payload);
  return {
    passengerName: first(s, ['passenger_name', 'name']),
    passengerPhoto: first(s, ['passenger_photo', 'photo']),
    seats: num(s.seats_booked),
    children: num(s.children) ?? 0,
    bookingId: first(s, ['booking_id']),
    message: first(s, ['message']),
  };
}

export interface Payout {
  id: string;
  amount: string | null;
  status: string | null;
  route: string | null;
  date: string | null;
  message: string | null;
}

export function parsePayouts(payload: unknown): Payout[] {
  return unwrapList(payload, ['records', 'payouts', 'escrows', 'items', 'results'])
    .map((v) => {
      const p = obj(v);
      const id = first(p, ['id', 'escrow_id']);
      if (!id) return null;
      return {
        id,
        amount: first(p, [
          'driver_amount',
          'driver_payout',
          'amount',
          'payout_amount',
          'net_amount',
        ]),
        status: first(p, ['status', 'payout_status']),
        route:
          (first(p, ['route']) ??
            [first(p, ['origin_city']), first(p, ['destination_city'])]
              .filter(Boolean)
              .join(' → ')) ||
          null,
        date: first(p, ['departure_time', 'completed_at', 'created_at']),
        message: first(p, ['message', 'status_message']),
      };
    })
    .filter((p): p is Payout => !!p);
}

/* ---------- api ---------- */

export const driverApi = {
  /** GET /api/drivers/profile/me. 404 = no vehicle yet. */
  async profile(): Promise<DriverProfile | null> {
    try {
      const { data } = await http.get(ENDPOINTS.driverProfileMe);
      return parseDriverProfileMe(data);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) return null;
      throw e;
    }
  },

  async createProfile(v: VehiclePayload): Promise<DriverProfile> {
    const { data } = await http.post(ENDPOINTS.driverProfile, {
      vehicle_make: v.make,
      vehicle_model: v.model,
      vehicle_year: Number(v.year) || v.year,
      vehicle_color: v.colour,
      plate_number: v.plate.toUpperCase(),
      seats_available: v.seats,
      license_number: v.licence,
      plate_colour: v.plateColour,
      private_vehicle_declaration: v.declaration,
    });
    return parseDriverProfileMe(data);
  },

  async meetingPoints(r: RouteInput): Promise<MeetingPoint[]> {
    const { data } = await http.get(ENDPOINTS.meetingPoints, {
      params: {
        origin_lat: r.originLat,
        origin_lng: r.originLng,
        dest_lat: r.destLat,
        dest_lng: r.destLng,
      },
    });
    return parseMeetingPoints(data);
  },

  async suggestPrice(r: RouteInput): Promise<PriceSuggestion> {
    const { data } = await http.get(ENDPOINTS.suggestPrice, {
      params: {
        origin_lat: r.originLat,
        origin_lng: r.originLng,
        destination_lat: r.destLat,
        destination_lng: r.destLng,
        origin_city: r.originCity,
        destination_city: r.destCity,
      },
    });
    const s = unwrap(data);
    return {
      suggested: first(s, ['driver_gets', 'driver_display_price', 'suggested_driver_price']),
      passengerPays: first(s, ['suggested_price', 'suggested_price_per_seat']),
      serviceFee: first(s, ['sr2go_fee', 'sr2go_service_fee']),
      message: first(s, ['message']),
    };
  },

  async checkPrice(r: RouteInput, driverPrice: string): Promise<PriceCheck> {
    // Staging contract: all check-price inputs are query parameters.
    const { data } = await http.post(ENDPOINTS.checkPrice, null, {
      params: {
        origin_lat: r.originLat,
        origin_lng: r.originLng,
        destination_lat: r.destLat,
        destination_lng: r.destLng,
        origin_city: r.originCity,
        destination_city: r.destCity,
        driver_price: Number(driverPrice),
      },
    });
    return parsePriceCheck(data);
  },

  /** POST /api/rides/. 403 driver_profile_required / driver_not_approved / driver_suspended. */
  async postRide(p: PostRidePayload): Promise<Ride | null> {
    const local = new Date(`${p.date}T${p.time}:00`);
    const off = -local.getTimezoneOffset();
    const sign = off >= 0 ? '+' : '-';
    const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');
    const { data } = await http.post(ENDPOINTS.rides, {
      origin_lat: p.route.originLat,
      origin_lng: p.route.originLng,
      origin_city: p.route.originCity,
      origin_address: p.originName,
      destination_lat: p.route.destLat,
      destination_lng: p.route.destLng,
      destination_city: p.route.destCity,
      destination_address: p.destName,
      // Local wall time with the phone's offset, so 07:30 in Lagos stays 07:30.
      departure_time: `${p.date}T${p.time}:00${sign}${pad(Math.floor(off / 60))}:${pad(off % 60)}`,
      total_seats: p.seats,
      vehicle_type: p.car,
      meeting_point_name: p.meetingPoint.name,
      meeting_point_address: p.meetingPoint.address,
      meeting_point_lat: p.meetingPoint.lat,
      meeting_point_lng: p.meetingPoint.lng,
      // price_per_seat is what the driver takes home; the server adds the fee.
      price_per_seat: Number(p.driverPrice),
      price_override_acknowledged: p.priceAcknowledged,
      override_route_acknowledged: p.priceAcknowledged,
      auto_approve: p.autoApprove,
      is_ac: p.isAc,
      pref_music: p.prefMusic,
      pref_pets: p.prefPets,
      pref_chat: p.prefChat,
      pref_smoking: p.prefSmoking,
      driver_smokes: p.driverSmokes,
      max_luggage_kg: p.maxLuggageKg,
      luggage_note: p.luggageNote || null,
      notes: p.notes || null,
    });
    return parseRide(data);
  },

  async myRides(): Promise<DriverRide[]> {
    const { data } = await http.get(ENDPOINTS.driverMyRides);
    return unwrapList(data, ['rides', 'items', 'results', 'data'])
      .map(parseDriverRide)
      .filter((r): r is DriverRide => !!r);
  },

  async ride(rideId: string): Promise<DriverRide | null> {
    const { data } = await http.get(ENDPOINTS.ride(rideId));
    return parseDriverRide(data);
  },

  async rideBookings(rideId: string): Promise<RideBooking[]> {
    const { data } = await http.get(ENDPOINTS.rideBookings(rideId));
    return parseRideBookings(data);
  },

  async setBookingStatus(bookingId: string, status: 'accepted' | 'rejected'): Promise<void> {
    await http.put(ENDPOINTS.bookingStatus(bookingId), { status });
  },

  async cancelRide(rideId: string, reason?: string): Promise<string | null> {
    const { data } = await http.post(ENDPOINTS.cancelRide(rideId), { reason: reason || undefined });
    return first(unwrap(data), ['message']);
  },

  async arrived(
    bookingId: string,
    pos: { latitude: number; longitude: number; accuracyM: number | null },
  ) {
    await http.post(ENDPOINTS.driverArrived(bookingId), {
      latitude: pos.latitude,
      longitude: pos.longitude,
      accuracy_m: pos.accuracyM,
    });
  },

  /** Online check of a passenger's QR (accepts the signed token). */
  async scanQr(bookingId: string, qrData: string): Promise<BoardingCheck> {
    const { data } = await http.post(ENDPOINTS.scanQr(bookingId), {
      booking_id: bookingId,
      qr_data: qrData,
    });
    return parseBoardingCheck(data);
  },

  async verifyPin(bookingId: string, code: string): Promise<BoardingCheck> {
    const { data } = await http.post(ENDPOINTS.verifyPin(bookingId), { boarding_code: code });
    return parseBoardingCheck(data);
  },

  async confirmBoarding(
    bookingId: string,
    faceMatched: boolean,
    reason?: string,
  ): Promise<string | null> {
    const { data } = await http.post(ENDPOINTS.confirmBoarding(bookingId), {
      face_matched: faceMatched,
      reason: reason || undefined,
    });
    return first(unwrap(data), ['message']);
  },

  async startRide(rideId: string): Promise<void> {
    await http.put(ENDPOINTS.startRide(rideId));
  },

  async completeRide(rideId: string): Promise<void> {
    await http.put(ENDPOINTS.completeRide(rideId));
  },

  async gpsPoint(
    bookingId: string,
    p: {
      latitude: number;
      longitude: number;
      accuracyM: number | null;
      speedKmh: number | null;
      heading: number | null;
    },
  ): Promise<void> {
    await http.post(ENDPOINTS.gpsPoint(bookingId), {
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy_m: p.accuracyM,
      speed_kmh: p.speedKmh,
      heading: p.heading,
    });
  },

  async earnings(): Promise<Payout[]> {
    const { data } = await http.get(ENDPOINTS.escrowMe);
    return parsePayouts(data);
  },
};

export { parseRides };
