/**
 * B2: bookings, payment and the boarding pass (Build Brief §E/F, DR3 §6,
 * backend updates 2, 15 and 16 Oct). Money stays a string: the app never
 * calculates a fare, a fee or a refund.
 */
import { ENDPOINTS, http } from './client';
import { parseRide, unwrap, unwrapList } from './parsers';
import { ridesApi } from './rides';
import type { Ride } from './types';

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

/** Brief "Status and value reference". */
export type BookingStatus =
  'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed' | 'unknown';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'unknown';

export interface Booking {
  id: string;
  rideId: string | null;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  seatsBooked: number;
  children: number;
  /** ISO; the passenger must pay before this once accepted. */
  payBy: string | null;
  /** ISO; set when the driver accepted. Null = the driver never answered. */
  acceptedAt: string | null;
  createdAt: string | null;
  boardingCode: string | null;
  /** Image URL, data URL, or a signed token to draw; null until paid. */
  qrCodeData: string | null;
  reference: string | null;
  payAmount: string | null;
  usualFare: string | null;
  savingsPct: number | null;
  /** Ride fields when the API nests or flattens them. */
  ride: Ride | null;
  departureDate: string | null;
  departureTime: string | null;
  originCity: string | null;
  destinationCity: string | null;
  meetingPointName: string | null;
  meetingPointAddress: string | null;
  meetingPointLat: number | null;
  meetingPointLng: number | null;
  driverName: string | null;
  driverVerified: boolean;
  vehicle: string | null;
  plate: string | null;
  isAc: boolean;
  pickupNote: string | null;
  frontSeatPreferred: boolean;
  raw: Json;
}

const STATUSES: BookingStatus[] = ['pending', 'accepted', 'rejected', 'cancelled', 'completed'];
const PAY: PaymentStatus[] = ['unpaid', 'paid', 'refunded'];

function readDeparture(s: Json): { date: string | null; time: string | null } {
  const dt = first(s, ['departure_time', 'departure_datetime', 'departure_at']);
  const date = first(s, ['departure_date']);
  if (dt && /^\d{4}-\d{2}-\d{2}T/.test(dt)) {
    return { date: dt.slice(0, 10), time: dt.slice(11, 16) };
  }
  return { date, time: dt && /^\d{2}:\d{2}/.test(dt) ? dt.slice(0, 5) : null };
}

export function parseBooking(payload: unknown): Booking | null {
  const s = unwrap(payload);
  const id = first(s, ['id', 'booking_id']);
  if (!id) return null;
  const rideRaw = obj(s.ride);
  const ride = Object.keys(rideRaw).length ? parseRide(rideRaw) : null;
  const src = { ...rideRaw, ...s } as Json; // booking fields win over nested ride fields
  const driver = obj(s.driver);
  const dep = readDeparture(src);
  const rawStatus = (first(s, ['status', 'booking_status']) ?? '').toLowerCase();
  const rawPay = (first(s, ['payment_status']) ?? '').toLowerCase();
  // Release 103: vehicle {make, model, colour, plate, description} once the driver has accepted.
  const veh = obj(s.vehicle);
  const vehicleParts = (
    Object.keys(veh).length
      ? [first(veh, ['colour', 'color']), first(veh, ['make']), first(veh, ['model'])]
      : [
          first(src, ['vehicle_color', 'vehicle_colour']),
          first(src, ['vehicle_make']),
          first(src, ['vehicle_model']),
        ]
  ).filter(Boolean);
  const seats = num(s.seats_booked) ?? 1;
  return {
    id,
    rideId: first(s, ['ride_id']) ?? ride?.id ?? null,
    status: (STATUSES as string[]).includes(rawStatus) ? (rawStatus as BookingStatus) : 'unknown',
    paymentStatus: (PAY as string[]).includes(rawPay) ? (rawPay as PaymentStatus) : 'unknown',
    seatsBooked: seats,
    children: num(s.children) ?? 0,
    payBy: first(s, ['pay_by', 'payment_deadline']),
    acceptedAt: first(s, ['accepted_at']),
    createdAt: first(s, ['created_at']),
    boardingCode: first(s, ['boarding_code']),
    qrCodeData: first(s, ['qr_code_data', 'qr_payload', 'my_qr']),
    reference: first(s, ['reference', 'payment_reference', 'booking_reference']),
    payAmount:
      first(s, ['pay_amount', 'you_pay', 'total_price', 'total_amount', 'total']) ??
      ride?.payAmount ??
      null,
    usualFare: first(s, ['usual_fare']) ?? ride?.usualFare ?? null,
    savingsPct: num(s.savings_pct) ?? ride?.savingsPct ?? null,
    ride,
    departureDate: dep.date ?? ride?.departureDate ?? null,
    departureTime: dep.time ?? ride?.departureTime ?? null,
    originCity: first(src, ['origin_city', 'origin', 'route_from']) ?? ride?.originCity ?? null,
    destinationCity:
      first(src, ['destination_city', 'destination', 'route_to']) ?? ride?.destinationCity ?? null,
    meetingPointName: first(src, ['meeting_point_name']) ?? ride?.meetingPointName ?? null,
    meetingPointAddress: first(src, ['meeting_point_address']) ?? ride?.meetingPointAddress ?? null,
    meetingPointLat: num(src.meeting_point_lat) ?? ride?.meetingPointLat ?? null,
    meetingPointLng: num(src.meeting_point_lng) ?? ride?.meetingPointLng ?? null,
    driverName: first(src, ['driver_name']) ?? first(driver, ['name']) ?? ride?.driverName ?? null,
    driverVerified:
      src.driver_verified === true || driver.verified === true || ride?.driverVerified === true,
    vehicle:
      (vehicleParts.length ? vehicleParts.join(' ') : null) ??
      first(veh, ['description']) ??
      (typeof s.vehicle === 'string' ? s.vehicle : null) ??
      first(src, ['vehicle_type']) ??
      ride?.vehicleType ??
      null,
    plate: first(veh, ['plate']) ?? first(src, ['plate_number', 'plate']),
    isAc: src.is_ac === true || ride?.isAc === true,
    pickupNote: first(s, ['pickup_note']),
    frontSeatPreferred: s.front_seat_preferred === true,
    raw: s,
  };
}

export function parseBookings(payload: unknown): Booking[] {
  return unwrapList(payload, ['bookings', 'results', 'items', 'data'])
    .map(parseBooking)
    .filter((b): b is Booking => !!b);
}

export interface CreateBookingPayload {
  rideId: string;
  /** Children under 18 travelling with the booker (13 Oct: one adult per booking). */
  children: number;
  frontSeatPreferred: boolean;
  pickupNote: string;
  pickupAddress: string;
  luggageKg: number | null;
  luggageDescription: string;
}

/* ---------- payments ---------- */

export interface PaymentInitiation {
  authorizationUrl: string | null;
  reference: string | null;
  total: string | null;
  creditsApplied: string | null;
  youPay: string | null;
  payBy: string | null;
  /** Wallet credit the passenger could use, when the API says. */
  creditsAvailable: string | null;
}

export function parseInitiation(payload: unknown): PaymentInitiation {
  const s = unwrap(payload);
  return {
    authorizationUrl: first(s, ['authorization_url', 'checkout_url', 'url']),
    reference: first(s, ['reference']),
    total: first(s, ['total', 'amount']),
    creditsApplied: first(s, ['credits_applied']),
    youPay: first(s, ['you_pay', 'amount_due']),
    payBy: first(s, ['pay_by']),
    creditsAvailable: first(s, ['credits_available', 'wallet_balance', 'available_credits']),
  };
}

export type VerifyStatus = 'paid' | 'refund_due' | 'underpaid' | 'refunded' | 'failed' | 'pending';

export interface PaymentVerification {
  success: boolean;
  status: VerifyStatus;
  message: string | null;
  youPaid: string | null;
  reference: string | null;
  bookingId: string | null;
}

export function parseVerification(payload: unknown): PaymentVerification {
  const s = unwrap(payload);
  const success = s.success === true || s.status === 'success' || s.status === 'paid';
  const raw = (first(s, ['status']) ?? '').toLowerCase();
  let status: VerifyStatus = success ? 'paid' : 'failed';
  if (!success) {
    if (raw === 'refund_due' || raw === 'late') status = 'refund_due';
    else if (raw === 'underpaid' || raw === 'amount_mismatch') status = 'underpaid';
    else if (raw === 'refunded') status = 'refunded';
    else if (raw === 'pending' || raw === 'processing') status = 'pending';
  }
  return {
    success,
    status,
    message: first(s, ['message']),
    youPaid: first(s, ['you_paid', 'amount_paid', 'amount']),
    reference: first(s, ['reference']),
    bookingId: first(s, ['booking_id']),
  };
}

/* ---------- contacts, tracking, cancellation ---------- */

export interface TripContact {
  name: string | null;
  role: string | null;
  phone: string | null;
  callsMasked: boolean;
  callNumber: string | null;
  callCode: string | null;
}

export interface TripContacts {
  contacts: TripContact[];
  /** Backend line when the contact window has closed. */
  message: string | null;
}

export function parseContacts(payload: unknown): TripContacts {
  const s = unwrap(payload);
  const list = Array.isArray(payload) ? payload : unwrapList(payload, ['contacts', 'items']);
  const one = list.length ? list : Object.keys(s).length && (s.phone || s.name) ? [s] : [];
  return {
    contacts: one.map((v) => {
      const c = obj(v);
      return {
        name: first(c, ['name', 'short_name', 'driver_name']),
        role: first(c, ['role']),
        phone: first(c, ['phone', 'phone_number', 'driver_phone']),
        callsMasked: c.calls_masked === true,
        callNumber: first(c, ['call_number']),
        callCode: first(c, ['call_code']),
      };
    }),
    message: first(s, ['message', 'detail']),
  };
}

export interface TrackingLink {
  trackingUrl: string | null;
  shareMessage: string | null;
  whatsappLink: string | null;
}

export interface CancellationPolicy {
  tier: string | null;
  cashRefund: string | null;
  creditRefund: string | null;
  message: string | null;
  canCancel: boolean;
}

export function parsePolicy(payload: unknown): CancellationPolicy {
  const s = unwrap(payload);
  return {
    tier: first(s, ['tier', 'policy', 'refund_tier']),
    cashRefund: first(s, ['cash_refund', 'refund_amount', 'refund']),
    creditRefund: first(s, ['credit_refund']),
    message:
      first(s, ['message', 'description', 'summary']) ??
      [first(s, ['policy_note']), first(s, ['service_fee_note'])].filter(Boolean).join(' ') ??
      null,
    canCancel: s.can_cancel !== false,
  };
}

/* ---------- api ---------- */

export const bookingsApi = {
  /** POST /api/rides/bookings. 409 "seats just taken" → back to results; 403 kyc_required. */
  async create(p: CreateBookingPayload): Promise<Booking> {
    const { data } = await http.post(ENDPOINTS.bookings, {
      ride_id: p.rideId,
      seats_booked: 1 + p.children,
      children: p.children,
      front_seat_preferred: p.frontSeatPreferred,
      pickup_note: p.pickupNote || null,
      pickup_address: p.pickupAddress || null,
      luggage_kg: p.luggageKg,
      luggage_description: p.luggageDescription || null,
    });
    const booking = parseBooking(data);
    if (!booking) throw new Error('The booking reply had no id');
    return booking;
  },

  /** GET /api/rides/bookings/mine. Grouped by the screens, never here. */
  async mine(): Promise<Booking[]> {
    const { data } = await http.get(ENDPOINTS.bookingsMine);
    const bookings = parseBookings(data);
    // bookings/mine carries booking fields only; the ride (route, driver, time) is fetched once per ride.
    // Release 103 adds the route to each booking; the ride call stays only for bookings without it.
    const rideIds = [
      ...new Set(
        bookings
          .filter((b) => !b.ride && (!b.originCity || !b.destinationCity || !b.departureDate))
          .map((b) => b.rideId)
          .filter((x): x is string => !!x),
      ),
    ];
    const rides = await Promise.all(rideIds.map((id) => ridesApi.get(id).catch(() => null)));
    const byId = new Map(rideIds.map((id, i) => [id, rides[i]]));
    return bookings.map((b) => {
      const ride = b.rideId ? byId.get(b.rideId) : null;
      return ride && !b.ride ? (parseBooking({ ...b.raw, ride: ride.raw }) ?? b) : b;
    });
  },

  /** The list is the only read endpoint for a single booking. */
  async get(bookingId: string): Promise<Booking | null> {
    const all = await bookingsApi.mine();
    return all.find((b) => b.id === bookingId) ?? null;
  },

  /** Passenger "Cancel request" / cancel booking: preview first, then confirm. */
  async cancellationPolicy(bookingId: string): Promise<CancellationPolicy> {
    const { data } = await http.get(ENDPOINTS.cancellationPolicy(bookingId));
    return parsePolicy(data);
  },

  async cancel(bookingId: string, reason?: string): Promise<CancellationPolicy> {
    const { data } = await http.post(ENDPOINTS.cancelBooking(bookingId), {
      reason: reason || undefined,
    });
    return parsePolicy(data);
  },

  async contacts(rideId: string): Promise<TripContacts> {
    const { data } = await http.get(ENDPOINTS.rideContacts(rideId));
    return parseContacts(data);
  },

  /** GET /api/rides/bookings/{id}/boarding-pass (paid bookings). */
  async boardingPass(bookingId: string): Promise<BoardingPass> {
    const { data } = await http.get(ENDPOINTS.boardingPass(bookingId));
    return parseBoardingPass(data);
  },

  /** Online driver check (no pack): the scanned trip QR text or the 4-digit code. */
  async scanDriver(
    bookingId: string,
    code: string,
  ): Promise<{
    name: string | null;
    verified: boolean;
    photo: string | null;
    vehicle: string | null;
  }> {
    const { data } = await http.post(ENDPOINTS.scanDriver(bookingId), { code });
    const s = unwrap(data);
    const d = obj(s.driver);
    const v = obj(d.vehicle ?? s.vehicle);
    const car = [first(v, ['colour', 'color']), first(v, ['make']), first(v, ['model'])]
      .filter(Boolean)
      .join(' ');
    const plate = first(v, ['plate', 'plate_number']);
    return {
      name: first(d, ['name']) ?? first(s, ['driver_name', 'name']),
      verified: d.verified === true || s.driver_verified === true,
      photo: first(d, ['photo']) ?? first(s, ['driver_photo', 'photo']),
      vehicle: [car, plate].filter(Boolean).join(' · ') || null,
    };
  },

  async passengerConfirm(
    bookingId: string,
    faceMatched: boolean,
    reason?: string,
  ): Promise<string | null> {
    const { data } = await http.post(ENDPOINTS.passengerConfirm(bookingId), {
      face_matched: faceMatched,
      reason: reason || undefined,
    });
    return first(unwrap(data), ['message']);
  },

  async trackingLink(bookingId: string): Promise<TrackingLink> {
    const { data } = await http.get(ENDPOINTS.trackingLink(bookingId));
    const s = unwrap(data);
    return {
      trackingUrl: first(s, ['tracking_url', 'url']),
      shareMessage: first(s, ['share_message']),
      whatsappLink: first(s, ['whatsapp_link']),
    };
  },
};

export interface BoardingPass {
  boardingCode: string | null;
  /** Signed token to draw as the QR (S2G1…), or an image URL on older rides. */
  qrPayload: string | null;
  driver: {
    name: string | null;
    verified: boolean;
    photo: string | null;
    vehicle: {
      make: string | null;
      model: string | null;
      colour: string | null;
      plate: string | null;
    } | null;
  };
  boarded: boolean;
  heldForReview: boolean;
}

export function parseBoardingPass(payload: unknown): BoardingPass {
  const s = unwrap(payload);
  const d = obj(s.driver);
  const v = obj(d.vehicle);
  const flags = obj(s.boarding);
  return {
    boardingCode: first(s, ['boarding_code']),
    qrPayload: first(s, ['qr_payload', 'my_qr', 'qr_code_data']),
    driver: {
      name: first(d, ['name']),
      verified: d.verified === true,
      photo: first(d, ['photo']),
      vehicle: Object.keys(v).length
        ? {
            make: first(v, ['make']),
            model: first(v, ['model']),
            colour: first(v, ['colour', 'color']),
            plate: first(v, ['plate', 'plate_number']),
          }
        : null,
    },
    boarded: flags.boarded === true,
    heldForReview: flags.held_for_review === true,
  };
}

export const paymentsApi = {
  /** POST /api/payments/initiate {booking_id, use_credits}. */
  async initiate(
    bookingId: string,
    useCredits: boolean,
    connectionId?: string,
  ): Promise<PaymentInitiation> {
    const { data } = await http.post(ENDPOINTS.paymentInitiate, {
      ...(connectionId ? { connection_id: connectionId } : { booking_id: bookingId }),
      use_credits: useCredits,
    });
    return parseInitiation(data);
  },

  /** POST /api/payments/verify {reference}. The only place a booking becomes "paid". */
  async verify(reference: string): Promise<PaymentVerification> {
    const { data } = await http.post(ENDPOINTS.paymentVerify, { reference });
    return parseVerification(data);
  },
};
