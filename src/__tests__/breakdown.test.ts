import { parseBreakdown, parseRescue, rescueStarted } from '../api/breakdown';

describe('breakdown and rescue', () => {
  it('reads the breakdown with each passenger rescue request', () => {
    const b = parseBreakdown({
      breakdown_id: 5,
      status: 'open',
      stranded_passenger_count: 2,
      rescue_requests: [{ rescue_request_id: 11, passenger_name: 'Test.O', status: 'pending' }],
    });
    expect(b.id).toBe('5');
    expect(b.strandedCount).toBe(2);
    expect(b.requests[0]).toEqual({ id: '11', passengerName: 'Test.O', status: 'pending' });
  });

  it('reads rescue candidates with the passenger own money line only', () => {
    const r = parseRescue({
      rescue_request_id: 11,
      status: 'pending',
      stranded_at: { address: 'Lokoja junction' },
      destination: { address: 'Abuja' },
      reconciliation: { breakdown_note: 'N9,000 held for your rescue ride' },
      rescue_candidates: [
        {
          rescue_ride_id: 70,
          driver_name: 'Ade.B',
          driver_rating: 4.7,
          price_per_seat: 12000,
          seats_left: 2,
          passenger_top_up: 3000,
        },
      ],
    });
    expect(r.strandedAt).toBe('Lokoja junction');
    expect(r.note).toBe('N9,000 held for your rescue ride');
    expect(r.candidates[0]).toMatchObject({
      rideId: '70',
      topUp: '3000',
      credit: null,
      seatsLeft: 2,
    });
  });

  it('hides "make my own way" once the rescue ride has started', () => {
    expect(rescueStarted('rescue_started')).toBe(true);
    expect(rescueStarted('pending')).toBe(false);
  });
});
