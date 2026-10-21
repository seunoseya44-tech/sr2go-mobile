/**
 * Build 7: ticket transfer, driver handover (16 Oct), trip chat, Tunde,
 * ratings, reports and connecting trips (DR3 §9). Every message shown to
 * the user comes from the backend where one exists.
 */
import { ENDPOINTS, http } from './client';
import { parseRide, unwrap, unwrapList } from './parsers';
import type { Ride } from './types';
import { env } from '../config/env';
import { session } from '../auth/session';

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

/* ---------- transfers and handovers (16 Oct) ---------- */

export interface PersonLookup {
  name: string | null;
  phoneMasked: string | null;
  verified: boolean;
  car: string | null;
  carApproved: boolean | null;
}

export interface Offer {
  id: string;
  status: string;
  fromName: string | null;
  toName: string | null;
  routeFrom: string | null;
  routeTo: string | null;
  departureTime: string | null;
  createdAt: string | null;
  bookingId: string | null;
  rideId: string | null;
}

function parseOffer(v: unknown, idKeys: string[]): Offer | null {
  const o = obj(v);
  const id = first(o, idKeys);
  if (!id) return null;
  return {
    id,
    status: (first(o, ['status']) ?? 'pending').toLowerCase(),
    fromName: first(o, ['from_name']),
    toName: first(o, ['to_name']),
    routeFrom: first(o, ['route_from', 'origin_city']),
    routeTo: first(o, ['route_to', 'destination_city']),
    departureTime: first(o, ['departure_time']),
    createdAt: first(o, ['created_at']),
    bookingId: first(o, ['booking_id']),
    rideId: first(o, ['ride_id']),
  };
}

function parseOffers(payload: unknown, idKeys: string[]): { incoming: Offer[]; outgoing: Offer[] } {
  const s = unwrap(payload);
  const list = (v: unknown) =>
    (Array.isArray(v) ? v : []).map((x) => parseOffer(x, idKeys)).filter((x): x is Offer => !!x);
  return { incoming: list(s.incoming), outgoing: list(s.outgoing) };
}

function parseLookup(payload: unknown): PersonLookup {
  const s = unwrap(payload);
  const car = obj(s.car);
  const carLine = [
    first(car, ['colour', 'color']),
    first(car, ['make']),
    first(car, ['model']),
    first(car, ['plate_masked', 'plate']),
  ]
    .filter(Boolean)
    .join(' ');
  return {
    name: first(s, ['name']),
    phoneMasked: first(s, ['phone_masked']),
    verified: s.verified === true,
    car: carLine || null,
    carApproved: typeof car.approved === 'boolean' ? car.approved : null,
  };
}

export const transfersApi = {
  lookup: async (phone: string) =>
    parseLookup((await http.post(ENDPOINTS.transfersLookup, { phone })).data),
  async offer(bookingId: string, phone: string): Promise<Offer | null> {
    const { data } = await http.post(ENDPOINTS.transfers, { booking_id: bookingId, phone });
    return parseOffer(data, ['transfer_id', 'id']);
  },
  list: async () => parseOffers((await http.get(ENDPOINTS.transfers)).data, ['transfer_id', 'id']),
  accept: async (id: string) =>
    first(unwrap((await http.post(ENDPOINTS.transferAction(id, 'accept'))).data), ['message']),
  decline: async (id: string) =>
    first(unwrap((await http.post(ENDPOINTS.transferAction(id, 'decline'))).data), ['message']),
  cancel: async (id: string) =>
    first(unwrap((await http.post(ENDPOINTS.transferAction(id, 'cancel'))).data), ['message']),
};

export const handoversApi = {
  lookup: async (phone: string) =>
    parseLookup((await http.post(ENDPOINTS.handoversLookup, { phone })).data),
  async offer(rideId: string, phone: string): Promise<Offer | null> {
    const { data } = await http.post(ENDPOINTS.handovers, { ride_id: rideId, phone });
    return parseOffer(data, ['handover_id', 'id']);
  },
  list: async () => parseOffers((await http.get(ENDPOINTS.handovers)).data, ['handover_id', 'id']),
  accept: async (id: string) =>
    first(unwrap((await http.post(ENDPOINTS.handoverAction(id, 'accept'))).data), ['message']),
  decline: async (id: string) =>
    first(unwrap((await http.post(ENDPOINTS.handoverAction(id, 'decline'))).data), ['message']),
  cancel: async (id: string) =>
    first(unwrap((await http.post(ENDPOINTS.handoverAction(id, 'cancel'))).data), ['message']),
};

/* ---------- travelling with (companions) ---------- */

export interface CompanionInvite {
  id: string;
  bookingId: string | null;
  companionBookingId: string | null;
  status: string;
  fromName: string | null;
  toName: string | null;
  toPhone: string | null;
  routeFrom: string | null;
  routeTo: string | null;
  departureTime: string | null;
  createdAt: string | null;
  consent: string | null;
  /** Outgoing accepted invites: the companion's own seat. */
  seat: { status: string | null; paymentStatus: string | null; totalPrice: string | null } | null;
}

function parseCompanion(v: unknown): CompanionInvite | null {
  const o = obj(v);
  const id = first(o, ['invite_id', 'id']);
  if (!id) return null;
  return {
    id,
    bookingId: first(o, ['booking_id']),
    companionBookingId: first(o, ['companion_booking_id']),
    status: (first(o, ['status']) ?? 'pending').toLowerCase(),
    fromName: first(o, ['from_name']),
    toName: first(o, ['to_name']),
    toPhone: first(o, ['to_phone']),
    routeFrom: first(o, ['route_from']),
    routeTo: first(o, ['route_to']),
    departureTime: first(o, ['departure_time']),
    createdAt: first(o, ['created_at']),
    consent: first(o, ['consent']),
    seat: Object.keys(obj(o.seat)).length
      ? {
          status: first(obj(o.seat), ['status']),
          paymentStatus: first(obj(o.seat), ['payment_status']),
          totalPrice: first(obj(o.seat), ['total_price']),
        }
      : null,
  };
}

export const companionsApi = {
  lookup: async (phone: string) =>
    parseLookup((await http.post(ENDPOINTS.companionsLookup, { phone })).data),
  async invite(
    bookingId: string,
    phone: string,
  ): Promise<{
    id: string | null;
    status: string | null;
    toName: string | null;
    message: string | null;
  }> {
    const { data } = await http.post(ENDPOINTS.companions, {
      booking_id: Number(bookingId),
      phone,
    });
    const s = unwrap(data);
    return {
      id: first(s, ['invite_id', 'id']),
      status: first(s, ['status']),
      toName: first(s, ['to_name']),
      message: first(s, ['message']),
    };
  },
  async list(): Promise<{ incoming: CompanionInvite[]; outgoing: CompanionInvite[] }> {
    const { data } = await http.get(ENDPOINTS.companions);
    const s = unwrap(data);
    const l = (v: unknown) =>
      (Array.isArray(v) ? v : []).map(parseCompanion).filter((x): x is CompanionInvite => !!x);
    return { incoming: l(s.incoming), outgoing: l(s.outgoing) };
  },
  async accept(
    id: string,
    p: { luggageKg: number | null; luggageDescription: string },
  ): Promise<string | null> {
    const { data } = await http.post(ENDPOINTS.companionAction(id, 'accept'), {
      luggage_kg: p.luggageKg,
      luggage_description: p.luggageDescription || null,
    });
    return first(unwrap(data), ['message']);
  },
  decline: async (id: string) =>
    first(unwrap((await http.post(ENDPOINTS.companionAction(id, 'decline'))).data), ['message']),
  cancel: async (id: string) =>
    first(unwrap((await http.post(ENDPOINTS.companionAction(id, 'cancel'))).data), ['message']),
};

/* ---------- trip chat ---------- */

export interface ChatMessage {
  id: string;
  senderId: string | null;
  senderName: string | null;
  senderRole: 'driver' | 'passenger' | null;
  text: string;
  sentAt: string | null;
  mine: boolean;
}

export interface ChatHistory {
  messages: ChatMessage[];
  /** The fixed line from the backend, or ours. */
  notice: string | null;
  open: boolean;
  message: string | null;
}

export function parseChat(payload: unknown, myId: string | null): ChatHistory {
  const s = unwrap(payload);
  const list = Array.isArray(payload)
    ? payload
    : unwrapList(payload, ['messages', 'items', 'results']);
  return {
    messages: list
      .map((v, i) => {
        const m = obj(v);
        const text = first(m, ['message', 'text', 'content', 'body']);
        if (!text) return null;
        const senderId = first(m, ['sender_id', 'user_id', 'from_id']);
        const role = (first(m, ['sender_role', 'role']) ?? '').toLowerCase();
        return {
          id: first(m, ['id', 'message_id']) ?? String(i),
          senderId,
          senderName: first(m, ['sender_name', 'name']),
          senderRole: role === 'driver' ? 'driver' : role === 'passenger' ? 'passenger' : null,
          text,
          sentAt: first(m, ['created_at', 'sent_at', 'timestamp']),
          mine: m.is_mine === true || (!!myId && senderId === myId),
        } as ChatMessage;
      })
      .filter((m): m is ChatMessage => !!m),
    notice: first(s, ['notice', 'header', 'retention_notice']),
    open: s.is_open !== false && s.open !== false,
    message: first(s, ['message']),
  };
}

export const chatApi = {
  async history(rideId: string, myId: string | null): Promise<ChatHistory> {
    const { data } = await http.get(ENDPOINTS.rideMessages(rideId));
    return parseChat(data, myId);
  },
  /** POST on the same path; the WebSocket is the live channel. */
  async send(rideId: string, message: string): Promise<void> {
    await http.post(ENDPOINTS.rideMessages(rideId), { content: message });
  },
  /** wss://…/ws/chat/{ride_id}?token=… */
  socketUrl(rideId: string): string {
    const base = env.apiBaseUrl || 'https://shareride2go.com';
    const token = session.getTokens()?.accessToken ?? '';
    return `${base.replace(/^http/, 'ws')}/ws/chat/${rideId}?token=${encodeURIComponent(token)}`;
  },
};

/* ---------- Tunde ---------- */

export interface TundeTurn {
  role: 'user' | 'assistant';
  content: string;
}

export const tundeApi = {
  async chat(message: string, history: TundeTurn[], visitorId: string): Promise<string> {
    const { data } = await http.post(
      ENDPOINTS.tundeChat,
      { message, history, visitor_id: visitorId },
      { skipSessionHandling: true },
    );
    const s = unwrap(data);
    return first(s, ['reply', 'message', 'answer', 'response']) ?? '';
  },
};

/* ---------- ratings and reports ---------- */

export const ratingsApi = {
  async rate(p: {
    bookingId: string;
    revieweeId: string;
    score: number;
    tags: string[];
    comment: string;
  }): Promise<void> {
    const comment = [p.tags.length ? p.tags.join(', ') : null, p.comment.trim() || null]
      .filter(Boolean)
      .join('. ');
    await http.post(ENDPOINTS.ratings, {
      booking_id: p.bookingId,
      reviewee_id: p.revieweeId,
      score: p.score,
      comment: comment || null,
    });
  },
};

export type DisputeCategory =
  | 'late_departure'
  | 'route_deviation'
  | 'journey_abandoned'
  | 'misconduct'
  | 'vehicle_condition'
  | 'other';

export const DISPUTE_LABELS: Record<DisputeCategory, string> = {
  late_departure: 'Late departure',
  route_deviation: 'Wrong route',
  journey_abandoned: 'Driver abandoned trip',
  misconduct: 'Driver misconduct',
  vehicle_condition: 'Vehicle condition',
  other: 'Other',
};

export interface Dispute {
  id: string;
  category: string | null;
  status: string | null;
  route: string | null;
  date: string | null;
  createdAt: string | null;
  resolution: string | null;
}

export const disputesApi = {
  async create(p: {
    bookingId: string;
    category: DisputeCategory;
    description: string;
    evidenceUrls: string[];
  }): Promise<{ id: string | null; message: string | null }> {
    const { data } = await http.post(ENDPOINTS.disputes, {
      booking_id: p.bookingId,
      category: p.category,
      description: p.description,
      evidence_urls: p.evidenceUrls,
    });
    const s = unwrap(data);
    return { id: first(s, ['id', 'dispute_id']), message: first(s, ['message']) };
  },
  async mine(): Promise<Dispute[]> {
    const { data } = await http.get(ENDPOINTS.disputesMine);
    return unwrapList(data, ['disputes', 'items', 'results'])
      .map((v) => {
        const d = obj(v);
        const id = first(d, ['id', 'dispute_id']);
        if (!id) return null;
        return {
          id,
          category: first(d, ['category']),
          status: first(d, ['status']),
          route:
            first(d, ['route']) ??
            ([first(d, ['origin_city']), first(d, ['destination_city'])]
              .filter(Boolean)
              .join(' → ') ||
              null),
          date: first(d, ['departure_time', 'trip_date']),
          createdAt: first(d, ['created_at']),
          resolution: first(d, ['resolution', 'resolution_note', 'admin_note']),
        };
      })
      .filter((d): d is Dispute => !!d);
  },
};

/* ---------- dispute rooms (21 Oct) ---------- */

export interface DisputeRoomSummary {
  id: string;
  category: string | null;
  status: string | null;
  locked: boolean;
  myRole: string | null;
  openedAt: string | null;
  messages: number | null;
  lastMessageAt: string | null;
}

export interface DisputeRoomMessage {
  id: string;
  senderName: string | null;
  senderRole: string | null;
  mine: boolean;
  text: string | null;
  /** Private link valid 10 minutes; never stored. */
  photoUrl: string | null;
  createdAt: string | null;
}

export interface DisputeRoom {
  id: string;
  category: string | null;
  description: string | null;
  status: string | null;
  locked: boolean;
  myRole: string | null;
  members: { name: string | null; role: string | null }[];
  messages: DisputeRoomMessage[];
}

export const disputeRoomsApi = {
  async rooms(): Promise<DisputeRoomSummary[]> {
    const { data } = await http.get(ENDPOINTS.disputeRooms);
    return unwrapList(data, ['rooms', 'items', 'results'])
      .map((v) => {
        const r = obj(v);
        const id = first(r, ['dispute_id', 'id']);
        if (!id) return null;
        return {
          id,
          category: first(r, ['category']),
          status: first(r, ['status']),
          locked: r.locked === true,
          myRole: first(r, ['my_role']),
          openedAt: first(r, ['opened_at', 'created_at']),
          messages: num(r.messages),
          lastMessageAt: first(r, ['last_message_at']),
        };
      })
      .filter((r): r is DisputeRoomSummary => !!r);
  },
  async room(id: string): Promise<DisputeRoom> {
    const { data } = await http.get(ENDPOINTS.disputeMessages(id));
    const s = unwrap(data);
    return {
      id: first(s, ['dispute_id', 'id']) ?? id,
      category: first(s, ['category']),
      description: first(s, ['description']),
      status: first(s, ['status']),
      locked: s.locked === true,
      myRole: first(s, ['my_role']),
      members: (Array.isArray(s.members) ? s.members : []).map((m) => ({
        name: first(obj(m), ['name']),
        role: first(obj(m), ['role']),
      })),
      messages: (Array.isArray(s.messages) ? s.messages : []).map((v, i) => {
        const m = obj(v);
        return {
          id: first(m, ['id']) ?? String(i),
          senderName: first(m, ['sender_name']),
          senderRole: first(m, ['sender_role']),
          mine: m.mine === true,
          text: first(m, ['text']),
          photoUrl: first(m, ['photo_url']),
          createdAt: first(m, ['created_at']),
        };
      }),
    };
  },
  async postMessage(id: string, text: string): Promise<void> {
    await http.post(ENDPOINTS.disputeMessages(id), { text });
  },
  /** Multipart: `photo` (JPEG/PNG ≤ 5 MB) and `caption`. */
  async uploadPhoto(
    id: string,
    file: { uri: string; name: string; type: string },
    caption: string,
  ): Promise<void> {
    const form = new FormData();
    form.append('photo', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    form.append('caption', caption);
    await http.post(ENDPOINTS.disputePhotos(id), form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

/* ---------- connecting trips ---------- */

export interface ConnectionOption {
  rideIds: [string, string];
  hub: string | null;
  connection: 'smooth' | 'longer_wait';
  changeover: {
    name: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
  };
  ride1: Ride | null;
  ride2: Ride | null;
  payAmount: string | null;
  usualFare: string | null;
  savingsPct: number | null;
}

export interface ConnectionLeg {
  bookingId: string | null;
  status: string | null;
  paymentStatus: string | null;
  boardingCode: string | null;
  ride: Ride | null;
}

export interface Connection {
  id: string;
  status: string;
  hub: string | null;
  changeover: ConnectionOption['changeover'];
  payAmount: string | null;
  payBy: string | null;
  legs: ConnectionLeg[];
  message: string | null;
  refund: { cash: string | null; credit: string | null } | null;
}

function parseChangeover(v: unknown) {
  const c = obj(v);
  return {
    name: first(c, ['name']),
    address: first(c, ['address']),
    lat: num(c.lat),
    lng: num(c.lng ?? c.lon),
  };
}

export function parseConnection(payload: unknown): Connection | null {
  const s = unwrap(payload);
  const id = first(s, ['id', 'connection_id']);
  if (!id) return null;
  const legs = (Array.isArray(s.legs) ? s.legs : []).map((v) => {
    const l = obj(v);
    return {
      bookingId: first(l, ['booking_id']),
      status: first(l, ['status']),
      paymentStatus: first(l, ['payment_status']),
      boardingCode: first(l, ['boarding_code']),
      ride: Object.keys(obj(l.ride)).length ? parseRide(l.ride) : null,
    };
  });
  return {
    id,
    status: (first(s, ['status']) ?? 'unknown').toLowerCase(),
    hub: first(s, ['hub']),
    changeover: parseChangeover(s.changeover_point),
    payAmount: first(s, ['pay_amount', 'total']),
    payBy: first(s, ['pay_by']),
    legs,
    message: first(s, ['message']),
    refund:
      s.cash_refund || s.credit_refund
        ? { cash: first(s, ['cash_refund']), credit: first(s, ['credit_refund']) }
        : null,
  };
}

export const connectionsApi = {
  async search(p: {
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
    date: string;
    seats: number;
  }): Promise<ConnectionOption[]> {
    const { data } = await http.post(ENDPOINTS.connectionsSearch, {
      origin_lat: p.originLat,
      origin_lng: p.originLng,
      destination_lat: p.destLat,
      destination_lng: p.destLng,
      date: p.date,
      seats: p.seats,
    });
    return unwrapList(data, ['options', 'results', 'items'])
      .map((v) => {
        const o = obj(v);
        const ids = Array.isArray(o.ride_ids) ? o.ride_ids.map(String) : [];
        if (ids.length !== 2) return null;
        return {
          rideIds: [ids[0]!, ids[1]!] as [string, string],
          hub: first(o, ['hub']),
          connection: o.connection === 'longer_wait' ? 'longer_wait' : 'smooth',
          changeover: parseChangeover(o.changeover_point),
          ride1: parseRide(o.ride_1),
          ride2: parseRide(o.ride_2),
          payAmount: first(o, ['pay_amount']),
          usualFare: first(o, ['usual_fare']),
          savingsPct: num(o.savings_pct),
        } as ConnectionOption;
      })
      .filter((o): o is ConnectionOption => !!o);
  },

  async create(p: {
    rideIds: [string, string];
    children: number;
    frontSeatPreferred: boolean;
    pickupNote: string;
    pickupAddress: string;
    luggageKg: number | null;
    luggageDescription: string;
  }): Promise<Connection> {
    const { data } = await http.post(ENDPOINTS.connections, {
      ride_ids: p.rideIds,
      seats_booked: 1 + p.children,
      children: p.children,
      front_seat_preferred: p.frontSeatPreferred,
      pickup_note: p.pickupNote || null,
      pickup_address: p.pickupAddress || null,
      luggage_kg: p.luggageKg,
      luggage_description: p.luggageDescription || null,
    });
    const c = parseConnection(data);
    if (!c) throw new Error('The connecting trip reply had no id');
    return c;
  },

  async get(id: string): Promise<Connection | null> {
    const { data } = await http.get(ENDPOINTS.connection(id));
    return parseConnection(data);
  },

  async mine(): Promise<Connection[]> {
    const { data } = await http.get(ENDPOINTS.connectionsMine);
    return unwrapList(data, ['connections', 'items', 'results', 'data'])
      .map(parseConnection)
      .filter((c): c is Connection => !!c);
  },
};
