import { ENDPOINTS, http } from './client';
import { parseDriverPack, parsePassengerPack, parseSyncAnswers } from '../boarding/parsers';
import { clockOffsetSeconds } from '../boarding/token';
import type { DriverPack, PassengerPack, SyncAnswer, SyncEvent } from '../boarding/types';

export interface PublicKeyInfo {
  alg: string;
  kid: string;
  publicKey: string;
  tokenPrefix: string;
}

/**
 * Offline boarding calls (live since 16 Oct 2026). Pack downloads note the
 * Date header so expiry checks can correct a wrong phone clock.
 */
export const boardingApi = {
  /** GET /api/boarding/public-key. 503 offline_boarding_off → online boarding only. */
  async publicKey(): Promise<PublicKeyInfo> {
    const { data } = await http.get(ENDPOINTS.boardingPublicKey);
    return {
      alg: String(data?.alg ?? 'Ed25519'),
      kid: String(data?.kid ?? ''),
      publicKey: String(data?.public_key ?? ''),
      tokenPrefix: String(data?.token_prefix ?? 'S2G1'),
    };
  },

  /** 409 pack_not_yet (with opens_at), no_boarding_pass, held_for_review, not_boardable. */
  async passengerPack(bookingId: string): Promise<PassengerPack> {
    const res = await http.get(ENDPOINTS.boardingPackBooking(bookingId));
    return parsePassengerPack(res.data, clockOffsetSeconds(res.headers?.date, Date.now()));
  },

  async driverPack(rideId: string): Promise<DriverPack> {
    const res = await http.get(ENDPOINTS.boardingPackRide(rideId));
    return parseDriverPack(res.data, clockOffsetSeconds(res.headers?.date, Date.now()));
  },

  /** Call once the pack AND its photos are stored; stops the 3-hour reminder. */
  async passengerPackSaved(bookingId: string): Promise<void> {
    await http.post(ENDPOINTS.boardingPackBookingSaved(bookingId));
  },

  async driverPackSaved(rideId: string): Promise<void> {
    await http.post(ENDPOINTS.boardingPackRideSaved(rideId));
  },

  /** POST /api/boarding/sync: up to 50 events in the order made. */
  async sync(events: SyncEvent[]): Promise<SyncAnswer[]> {
    const { data } = await http.post(ENDPOINTS.boardingSync, {
      events: events.slice(0, 50).map((e) => ({
        event_id: e.eventId,
        booking_id: e.bookingId,
        side: e.side,
        scanned: e.scanned,
        face_matched: e.faceMatched,
        reason: e.reason,
        phone_time: e.phoneTime,
      })),
    });
    return parseSyncAnswers(data);
  },
};
