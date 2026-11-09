import { postReadiness } from '../verification/postReadiness';
import { kgLabel, kgOptions } from '../components/KgPicker';
import { BUSY_SCREENS, parseTripsToRate, pickTripToRate, rateParams } from '../rating/ratingPrompt';
import { clock12, isNightTime } from '../utils/time';

describe('luggage is chosen, not typed (Martin, 9 Nov 2026)', () => {
  it('offers No luggage and 1 to the top weight from the settings', () => {
    expect(kgOptions(20, null)).toEqual(Array.from({ length: 21 }, (_, i) => i));
  });
  it("never offers more than the driver's own limit for the ride", () => {
    expect(kgOptions(20, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(kgOptions(20, 0)).toEqual([0]);
    expect(kgOptions(15, 30).length).toBe(16);
  });
  it('reads naturally', () => {
    expect(kgLabel(null)).toBe('Choose');
    expect(kgLabel(0)).toBe('No luggage');
    expect(kgLabel(10)).toBe('10 kg');
  });
});

describe('times as people read them, and the night check', () => {
  it('shows 12-hour times', () => {
    expect(clock12('07:00')).toBe('7:00 AM');
    expect(clock12('00:00')).toBe('12:00 AM');
    expect(clock12('12:30')).toBe('12:30 PM');
    expect(clock12('18:05')).toBe('6:05 PM');
    expect(clock12(null)).toBeNull();
    expect(clock12('soon')).toBe('soon');
  });
  it('flags a departure between 10 PM and 5 AM', () => {
    expect(isNightTime('00:00', 22, 5)).toBe(true); // Okey's rides 32 and 34
    expect(isNightTime('23:30', 22, 5)).toBe(true);
    expect(isNightTime('04:59', 22, 5)).toBe(true);
    expect(isNightTime('05:00', 22, 5)).toBe(false);
    expect(isNightTime('07:00', 22, 5)).toBe(false);
    expect(isNightTime('21:59', 22, 5)).toBe(false);
  });
});

describe('rating pops up after the trip', () => {
  const answer = [
    {
      booking_id: 52,
      ride_id: 31,
      driver_id: 75,
      driver_name: 'Seun O.',
      origin_city: 'Ilorin',
      destination_city: 'Ibadan',
      departure_time: '2026-11-08T17:00:00Z',
    },
    {
      booking_id: 40,
      ride_id: 29,
      driver_id: 75,
      driver_name: 'Seun O.',
      origin_city: 'Ilorin',
      destination_city: 'Kano',
      departure_time: '2026-11-06T06:00:00Z',
    },
  ];
  it('reads the server list and picks the newest trip not yet offered on this phone', () => {
    const trips = parseTripsToRate(answer);
    expect(pickTripToRate(trips, new Set())!.bookingId).toBe('52');
    expect(pickTripToRate(trips, new Set(['52']))!.bookingId).toBe('40');
    expect(pickTripToRate(trips, new Set(['52', '40']))).toBeNull(); // Skip means skip
    expect(parseTripsToRate({ detail: 'x' })).toEqual([]);
  });
  it('opens Rate your trip for that driver and booking', () => {
    const p = rateParams(parseTripsToRate(answer)[0]!);
    expect(p.bookingId).toBe('52');
    expect(p.revieweeId).toBe('75');
    expect(p.name).toBe('Seun O.');
    expect(p.route).toMatch(/^Ilorin → Ibadan · /);
    expect(p.rideId).toBe('31');
  });
  it('never covers a payment or a trip under way', () => {
    for (const s of ['Payment', 'PassengerTrip', 'RateTrip', 'DisputeRoom'])
      expect(BUSY_SCREENS.has(s)).toBe(true);
    expect(BUSY_SCREENS.has('Main')).toBe(false);
  });
});

describe('Post a ride says what is missing on its first step (Seun, 8 Nov 2026)', () => {
  it('asks a driver without a bank account to add it first', () => {
    const r = postReadiness({ identity_verified: true, bank_required: true, bank_verified: false });
    expect(r.missing).toBe('bank');
    expect(r.message).toMatch(/Add your bank account/);
  });
  it('asks for the identity check before the bank', () => {
    expect(
      postReadiness({ identity_verified: false, bank_required: true, bank_verified: false })
        .missing,
    ).toBe('identity');
  });
  it('lets a fully verified driver go on', () => {
    expect(
      postReadiness({ identity_verified: true, bank_required: true, bank_verified: true }),
    ).toEqual({
      missing: null,
      message: null,
    });
  });
});
