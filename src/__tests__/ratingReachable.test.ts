import {
  BUSY_SCREENS,
  RATE_NOW_PUSHES,
  parseRidesToRate,
  parseTripsToRate,
  rateParams,
} from '../rating/ratingPrompt';

describe('rating is always reachable (Martin, 9 Nov 2026, booking 73)', () => {
  it("opens Rate your trip from the server's answer to I've arrived", () => {
    const answer = {
      arrived: true,
      booking_id: 73,
      ride_id: 39,
      driver_id: 75,
      driver_name: 'Seun O.',
      origin_city: 'Nnewi',
      destination_city: 'Awka',
      departure_time: '2026-11-10T06:00:00Z',
    };
    const trip = parseTripsToRate([answer])[0]!;
    const p = rateParams(trip);
    expect(p.bookingId).toBe('73');
    expect(p.revieweeId).toBe('75');
    expect(p.route).toMatch(/^Nnewi → Awka/);
  });

  it('checks at once when the trip-completed push arrives with the app open', () => {
    expect(RATE_NOW_PUSHES.has('ride_completed')).toBe(true);
  });

  it('offers the driver the rides whose passengers he has not rated', () => {
    const rides = parseRidesToRate([
      { ride_id: 39, origin_city: 'Nnewi', destination_city: 'Awka', passengers_to_rate: 2 },
      { ride_id: 38, origin_city: 'Ilorin', destination_city: 'Ibadan', passengers_to_rate: 0 },
    ]);
    expect(rides).toEqual([{ rideId: '39', route: 'Nnewi → Awka' }]);
    expect(parseRidesToRate({ detail: 'x' })).toEqual([]);
  });

  it("never covers the driver's boarding, trip or photo screens", () => {
    for (const s of [
      'DriverBoarding',
      'ScanPassenger',
      'EvidenceCamera',
      'ActiveTrip',
      'RatePassengers',
    ])
      expect(BUSY_SCREENS.has(s)).toBe(true);
  });
});
