/**
 * Offline QR check (SR2Go update 16 Oct 2026).
 *
 * A QR holds a token `S2G1.<payload>.<signature>` (base64url, no padding).
 * The phone verifies the Ed25519 signature over the bytes of "S2G1." + payload
 * with the key from the boarding pack, then checks the payload against the
 * pack. Nothing here touches the network, so it works with no signal.
 */
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';

// @noble/ed25519 v2 has no built-in sync hash; React Native has no WebCrypto SHA-512.
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

export const TOKEN_PREFIX = 'S2G1';

export interface PassengerQrPayload {
  t: 'p';
  /** booking id */
  b: string;
  /** ride id */
  r: string;
  /** passenger id */
  u: string;
  /** expiry, unix seconds */
  e: number;
  /** key id */
  k: string;
}

export interface TripQrPayload {
  t: 'd';
  r: string;
  /** driver id */
  u: string;
  e: number;
  k: string;
}

export type QrPayload = PassengerQrPayload | TripQrPayload;

export type QrFailure =
  | 'bad_format'
  | 'bad_signature'
  | 'bad_payload'
  | 'expired'
  | 'wrong_ride'
  | 'wrong_person'
  | 'not_in_pack';

export type QrCheck<P extends QrPayload = QrPayload> =
  { ok: true; payload: P } | { ok: false; reason: QrFailure };

/** The user-facing line for every failure: SR2Go wants one message, no detail. */
export const QR_FAILURE_MESSAGE = 'This code is not for this trip.';

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  try {
    const bin = globalThis.atob(b64 + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return globalThis.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function utf8Decode(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

function isPayload(v: unknown): v is QrPayload {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  const common =
    typeof o.r === 'string' &&
    typeof o.u === 'string' &&
    typeof o.e === 'number' &&
    typeof o.k === 'string';
  if (!common) return false;
  if (o.t === 'd') return true;
  return o.t === 'p' && typeof o.b === 'string';
}

export interface VerifyOptions {
  /** `key.public_key` from the pack: raw 32 bytes, base64url, no padding. */
  publicKey: string;
  /** Phone time in unix seconds, already corrected by the Date-header offset. */
  nowSeconds: number;
}

/** Signature + shape + expiry. The side-specific checks come after. */
export function verifyToken(token: string, opts: VerifyOptions): QrCheck {
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX || !parts[1] || !parts[2]) {
    return { ok: false, reason: 'bad_format' };
  }
  const [, payloadB64, sigB64] = parts;
  const sig = fromBase64Url(sigB64);
  const key = fromBase64Url(opts.publicKey);
  if (!sig || sig.length !== 64 || !key || key.length !== 32)
    return { ok: false, reason: 'bad_signature' };

  let valid = false;
  try {
    valid = ed.verify(sig, utf8(`${TOKEN_PREFIX}.${payloadB64}`), key);
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: 'bad_signature' };

  const raw = fromBase64Url(payloadB64);
  if (!raw) return { ok: false, reason: 'bad_payload' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(utf8Decode(raw));
  } catch {
    return { ok: false, reason: 'bad_payload' };
  }
  if (!isPayload(parsed)) return { ok: false, reason: 'bad_payload' };
  if (parsed.e <= opts.nowSeconds) return { ok: false, reason: 'expired' };
  return { ok: true, payload: parsed };
}

/** Passenger scanning the driver's trip QR. */
export function checkTripQr(
  token: string,
  pack: { rideId: string; driverUserId: string; publicKey: string },
  nowSeconds: number,
): QrCheck<TripQrPayload> {
  const res = verifyToken(token, { publicKey: pack.publicKey, nowSeconds });
  if (!res.ok) return res;
  const p = res.payload;
  if (p.t !== 'd') return { ok: false, reason: 'bad_payload' };
  if (p.r !== pack.rideId) return { ok: false, reason: 'wrong_ride' };
  if (p.u !== pack.driverUserId) return { ok: false, reason: 'wrong_person' };
  return { ok: true, payload: p };
}

/** Driver scanning a passenger's QR: the booking must be in the driver pack. */
export function checkPassengerQr(
  token: string,
  pack: {
    rideId: string;
    publicKey: string;
    passengers: { bookingId: string; passengerId: string }[];
  },
  nowSeconds: number,
): QrCheck<PassengerQrPayload> {
  const res = verifyToken(token, { publicKey: pack.publicKey, nowSeconds });
  if (!res.ok) return res;
  const p = res.payload;
  if (p.t !== 'p') return { ok: false, reason: 'bad_payload' };
  if (p.r !== pack.rideId) return { ok: false, reason: 'wrong_ride' };
  const entry = pack.passengers.find((x) => x.bookingId === p.b);
  if (!entry) return { ok: false, reason: 'not_in_pack' };
  if (entry.passengerId !== p.u) return { ok: false, reason: 'wrong_person' };
  return { ok: true, payload: p };
}

/**
 * Clock correction: seconds to add to the phone clock to get server time,
 * taken from the Date header of the pack download. Phones can be hours off;
 * SR2Go says never refuse a scan over that.
 */
export function clockOffsetSeconds(dateHeader: string | undefined, phoneNowMs: number): number {
  if (!dateHeader) return 0;
  const server = Date.parse(dateHeader);
  if (Number.isNaN(server)) return 0;
  return Math.round((server - phoneNowMs) / 1000);
}
