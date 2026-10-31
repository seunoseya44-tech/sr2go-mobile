/**
 * Server features added to the app on 30 Oct (Ifeanyi's API reference):
 * driver boarding list, ride alerts, public reviews, meeting-point change and
 * company booking (employee side). The server decides everything; the app
 * shows what comes back. Parsers are tolerant of field names until the
 * answers are confirmed on staging.
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
const bool = (s: Json, keys: string[]) => keys.some((k) => s[k] === true);
const message = (data: unknown) => first(unwrap(data), ['message', 'detail']);

/* ---------------- 1. Driver's boarding list ---------------- */

export interface BoardingListPassenger {
  bookingId: string;
  name: string | null;
  verified: boolean;
  photo: string | null;
  seats: number;
  children: number;
  driverCode: string | null;
  driverQrPayload: string | null;
  driverCheckedPassenger: boolean;
  passengerCheckedDriver: boolean;
  driverConfirmedFace: boolean;
  passengerConfirmedFace: boolean;
  boarded: boolean;
  held: boolean;
}

export function parseBoardingList(payload: unknown): BoardingListPassenger[] {
  return unwrapList(payload, ['passengers', 'boarding_list', 'bookings'])
    .map((v) => {
      const p = obj(v);
      const f = { ...p, ...obj(p.boarding) };
      const id = first(p, ['booking_id', 'id']);
      if (!id) return null;
      return {
        bookingId: id,
        name: first(p, ['passenger_name', 'name']),
        verified: bool(p, ['passenger_verified', 'verified']),
        photo: first(p, ['photo', 'passenger_photo', 'photo_url']),
        seats: num(p.seats_booked) ?? 1,
        // Guide: children = seats beyond the first, when the server sends no children field.
        children: num(p.children) ?? Math.max(0, (num(p.seats_booked) ?? 1) - 1),
        driverCode: first(p, ['driver_code']),
        driverQrPayload: first(p, ['driver_qr_payload', 'driver_qr']),
        driverCheckedPassenger: bool(f, ['driver_checked_passenger_code']),
        passengerCheckedDriver: bool(f, ['passenger_checked_driver_code']),
        driverConfirmedFace: bool(f, ['driver_confirmed_face']),
        passengerConfirmedFace: bool(f, ['passenger_confirmed_face']),
        boarded: bool(f, ['boarded']),
        held: bool(f, ['held_for_review']),
      };
    })
    .filter((p): p is BoardingListPassenger => !!p);
}

/* ---------------- 2. Ride alerts ---------------- */

export interface RideAlert {
  id: string;
  from: string | null;
  to: string | null;
  date: string | null;
  seats: number | null;
  maxPrice: string | null;
}

export interface NewRideAlert {
  originLat: number;
  originLng: number;
  originAddress?: string;
  destinationLat: number;
  destinationLng: number;
  destinationAddress?: string;
  travelDate: string;
  seatsNeeded?: number;
  maxPricePerSeat?: number | null;
}

function parseAlert(v: unknown): RideAlert | null {
  const a = obj(v);
  const id = first(a, ['id', 'alert_id']);
  if (!id) return null;
  return {
    id,
    from: first(a, ['origin_address', 'origin_city', 'origin']),
    to: first(a, ['destination_address', 'destination_city', 'destination']),
    date: first(a, ['travel_date', 'date']),
    seats: num(a.seats_needed),
    maxPrice: first(a, ['max_price_per_seat']),
  };
}

/* ---------------- 3. Public reviews ---------------- */

export interface ReviewReply {
  id: string;
  author: string | null;
  role: string | null;
  body: string;
  createdAt: string | null;
}

export interface PublicReview {
  id: string;
  author: string | null;
  body: string;
  complaint: boolean;
  createdAt: string | null;
  replies: ReviewReply[];
}

export interface ReviewSummary {
  total: number;
  complaints: number;
  testimonies: number;
  reviews: PublicReview[];
}

export function parseReviews(payload: unknown): ReviewSummary {
  const s = unwrap(payload);
  const reviews = unwrapList(s, ['reviews'])
    .map((v) => {
      const r = obj(v);
      const id = first(r, ['id', 'review_id']);
      if (!id) return null;
      const replies = (Array.isArray(r.replies) ? r.replies : [])
        .map((x) => {
          const y = obj(x);
          const rid = first(y, ['id', 'reply_id']);
          const body = first(y, ['body', 'text']);
          if (!rid || !body) return null;
          return {
            id: rid,
            author: first(y, ['author_name', 'author', 'name']),
            role: first(y, ['reply_type', 'role', 'type']),
            body,
            createdAt: first(y, ['created_at']),
          };
        })
        .filter((x): x is ReviewReply => !!x);
      return {
        id,
        author: first(r, ['author_name', 'author', 'reviewer_name']),
        body: first(r, ['body', 'text']) ?? '',
        complaint: r.is_complaint === true,
        createdAt: first(r, ['created_at']),
        replies,
      };
    })
    .filter((r): r is PublicReview => !!r);
  return {
    total: num(s.total) ?? reviews.length,
    complaints: num(s.complaints) ?? reviews.filter((r) => r.complaint).length,
    testimonies: num(s.testimonies) ?? reviews.filter((r) => !r.complaint).length,
    reviews,
  };
}

/* ---------------- 4. Meeting-point change ---------------- */

export interface MeetingProposal {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
  status: string | null;
  myAnswer: boolean | null;
  accepted: number | null;
  pending: number | null;
  createdAt: string | null;
}

export function parseProposals(payload: unknown): MeetingProposal[] {
  return unwrapList(payload, ['proposals'])
    .map((v) => {
      const p = obj(v);
      const id = first(p, ['id', 'proposal_id']);
      if (!id) return null;
      const mine = p.my_response ?? p.my_answer ?? p.accepted_by_me;
      return {
        id,
        name: first(p, ['name', 'meeting_point_name']) ?? 'New meeting point',
        address: first(p, ['address', 'meeting_point_address']),
        lat: num(p.lat),
        lng: num(p.lng),
        note: first(p, ['note']),
        status: first(p, ['status']),
        myAnswer: typeof mine === 'boolean' ? mine : null,
        accepted: num(p.accepted_count ?? p.accepted),
        pending: num(p.pending_count ?? p.pending),
        createdAt: first(p, ['created_at']),
      };
    })
    .filter((p): p is MeetingProposal => !!p);
}

/* ---------------- 5. Company booking ---------------- */

export interface CompanyInvite {
  company: string | null;
  email: string | null;
  notice: string | null;
}

export interface Company {
  id: string;
  name: string | null;
  email: string | null;
  raw: Json;
}

/** Accepts a pasted invite link or the bare token. */
export function inviteToken(input: string): string {
  const t = input.trim();
  const m = /[?&](?:token|invite_token)=([^&#\s]+)/.exec(t);
  return m ? decodeURIComponent(m[1]!) : t;
}

/** The user's company id from /api/auth/me (field name tolerant). */
export function companyIdOf(raw: Record<string, unknown> | null | undefined): string | null {
  if (!raw) return null;
  const c = obj(raw.corporate ?? raw.company);
  return first(raw, ['corporate_id', 'corp_id', 'company_id']) ?? first(c, ['id', 'corporate_id']);
}

/* ---------------- calls ---------------- */

export const featuresApi = {
  async boardingList(rideId: string) {
    const { data } = await http.get(ENDPOINTS.boardingList(rideId));
    return parseBoardingList(data);
  },

  async alerts(): Promise<RideAlert[]> {
    const { data } = await http.get(ENDPOINTS.alerts);
    return unwrapList(data, ['alerts'])
      .map(parseAlert)
      .filter((a): a is RideAlert => !!a);
  },
  async createAlert(a: NewRideAlert): Promise<string> {
    const { data } = await http.post(ENDPOINTS.alerts, {
      origin_lat: a.originLat,
      origin_lng: a.originLng,
      origin_address: a.originAddress,
      destination_lat: a.destinationLat,
      destination_lng: a.destinationLng,
      destination_address: a.destinationAddress,
      travel_date: a.travelDate,
      seats_needed: a.seatsNeeded,
      max_price_per_seat: a.maxPricePerSeat ?? null,
    });
    return message(data) ?? "Done. We'll tell you when a ride is posted on this route.";
  },
  async deleteAlert(id: string) {
    await http.delete(ENDPOINTS.alert(id));
  },

  async reviews(userId: string) {
    const { data } = await http.get(ENDPOINTS.reviewsOf(userId), { skipSessionHandling: true });
    return parseReviews(data);
  },
  async writeReview(p: { subjectId: string; bookingId: string; body: string; complaint: boolean }) {
    const { data } = await http.post(ENDPOINTS.reviews, {
      subject_id: Number(p.subjectId),
      booking_id: Number(p.bookingId),
      body: p.body,
      is_complaint: p.complaint,
    });
    return message(data) ?? 'Your review is now public.';
  },
  async reply(reviewId: string, body: string) {
    const { data } = await http.post(ENDPOINTS.reviewReply(reviewId), { body });
    return message(data) ?? 'Reply posted.';
  },
  async flag(reviewId: string) {
    const { data } = await http.put(ENDPOINTS.reviewFlag(reviewId));
    return message(data) ?? 'Thanks. SR2Go will look at this review.';
  },

  async proposals(rideId: string) {
    const { data } = await http.get(ENDPOINTS.meetingProposals(rideId));
    return parseProposals(data);
  },
  async propose(
    rideId: string,
    p: { name: string; address: string | null; lat: number; lng: number; note: string },
  ) {
    const { data } = await http.post(ENDPOINTS.meetingProposals(rideId), {
      name: p.name,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      note: p.note || null,
    });
    return message(data) ?? 'Sent to everyone on this trip.';
  },
  async respond(rideId: string, proposalId: string, accept: boolean) {
    const { data } = await http.post(ENDPOINTS.meetingProposalRespond(rideId, proposalId), {
      accept,
    });
    return message(data) ?? (accept ? 'You agreed.' : 'You said no.');
  },

  async validateInvite(token: string): Promise<CompanyInvite> {
    const { data } = await http.get(ENDPOINTS.corporateInviteValidate, {
      params: { token },
      skipSessionHandling: true,
    });
    const s = unwrap(data);
    const c = obj(s.corporate ?? s.company);
    return {
      company: first(s, ['company_name', 'corporate_name', 'name']) ?? first(c, ['name']),
      email: first(s, ['email', 'invited_email']),
      notice: first(s, ['notice', 'message']),
    };
  },
  async acceptInvite(token: string) {
    const { data } = await http.post(ENDPOINTS.corporateInviteAccept, { token });
    return message(data) ?? 'You have joined the company.';
  },
  async company(corpId: string): Promise<Company> {
    const { data } = await http.get(ENDPOINTS.corporate(corpId));
    const s = unwrap(data);
    return {
      id: first(s, ['id']) ?? corpId,
      name: first(s, ['name', 'company_name']),
      email: first(s, ['contact_email', 'email']),
      raw: s,
    };
  },
  async setBusinessTrip(bookingId: string, on: boolean) {
    const { data } = await http.put(ENDPOINTS.businessTrip(bookingId), { business_trip: on });
    return message(data);
  },
};
