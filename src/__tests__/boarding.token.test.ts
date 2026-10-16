import * as ed from '@noble/ed25519';

import {
  checkPassengerQr,
  checkTripQr,
  clockOffsetSeconds,
  toBase64Url,
  verifyToken,
} from '../boarding/token';

// A fixed test key: deterministic signatures, no randomness needed.
const priv = new Uint8Array(32).map((_, i) => (i * 7 + 3) & 0xff);
const pub = ed.getPublicKey(priv);
const publicKey = toBase64Url(pub);
const otherKey = toBase64Url(ed.getPublicKey(new Uint8Array(32).fill(9)));

function sign(payload: object, key: Uint8Array = priv): string {
  const p = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = ed.sign(new TextEncoder().encode(`S2G1.${p}`), key);
  return `S2G1.${p}.${toBase64Url(sig)}`;
}

const NOW = 1_760_000_000;
const trip = { t: 'd', r: 'ride-1', u: 'drv-1', e: NOW + 3600, k: 'k1' };
const pass = { t: 'p', b: 'bk-1', r: 'ride-1', u: 'pax-1', e: NOW + 3600, k: 'k1' };

describe('verifyToken', () => {
  it('accepts a token signed with the pack key', () => {
    const res = verifyToken(sign(trip), { publicKey, nowSeconds: NOW });
    expect(res).toEqual({ ok: true, payload: trip });
  });

  it('rejects the wrong prefix, a broken signature and a foreign key', () => {
    const good = sign(trip);
    expect(verifyToken(good.replace('S2G1.', 'S2G0.'), { publicKey, nowSeconds: NOW })).toEqual({
      ok: false,
      reason: 'bad_format',
    });
    const tampered =
      good.slice(0, -40) + (good.endsWith('A', good.length - 39) ? 'B' : 'A') + good.slice(-39);
    expect(verifyToken(tampered, { publicKey, nowSeconds: NOW })).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
    expect(verifyToken(good, { publicKey: otherKey, nowSeconds: NOW })).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('rejects an expired token', () => {
    expect(verifyToken(sign({ ...trip, e: NOW - 1 }), { publicKey, nowSeconds: NOW })).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('rejects a payload that is signed but not a boarding token', () => {
    expect(verifyToken(sign({ hello: 'world' }), { publicKey, nowSeconds: NOW })).toEqual({
      ok: false,
      reason: 'bad_payload',
    });
  });
});

describe('side checks', () => {
  const passengerPack = { rideId: 'ride-1', driverUserId: 'drv-1', publicKey };
  const driverPack = {
    rideId: 'ride-1',
    publicKey,
    passengers: [{ bookingId: 'bk-1', passengerId: 'pax-1' }],
  };

  it('passenger: the trip QR must be for this ride and this driver', () => {
    expect(checkTripQr(sign(trip), passengerPack, NOW).ok).toBe(true);
    expect(checkTripQr(sign({ ...trip, r: 'ride-2' }), passengerPack, NOW)).toEqual({
      ok: false,
      reason: 'wrong_ride',
    });
    expect(checkTripQr(sign(pass), passengerPack, NOW)).toEqual({
      ok: false,
      reason: 'bad_payload',
    });
  });

  it('driver: the passenger QR must be a booking in the pack', () => {
    expect(checkPassengerQr(sign(pass), driverPack, NOW).ok).toBe(true);
    expect(checkPassengerQr(sign({ ...pass, b: 'bk-9' }), driverPack, NOW)).toEqual({
      ok: false,
      reason: 'not_in_pack',
    });
    expect(checkPassengerQr(sign({ ...pass, u: 'pax-2' }), driverPack, NOW)).toEqual({
      ok: false,
      reason: 'wrong_person',
    });
  });
});

describe('clockOffsetSeconds', () => {
  it('measures the phone clock against the Date header', () => {
    const phone = Date.parse('2026-10-16T08:00:00Z');
    expect(clockOffsetSeconds('Fri, 16 Oct 2026 10:00:00 GMT', phone)).toBe(7200);
    expect(clockOffsetSeconds(undefined, phone)).toBe(0);
    expect(clockOffsetSeconds('nonsense', phone)).toBe(0);
  });
});
