/** "Booking closed" (Martin, 7 Nov 2026): the server's booking_closes_at decides; a later-ride search is ready. */
import { toApiError } from '../api/errors';
import { parseRide } from '../api/parsers';
import { bookingClosed, laterRideSearch, placeOf } from '../booking/bookingClosed';

const raw = {
  id: 9,
  origin_address: 'Ilorin, Kwara',
  origin_lat: 8.4966,
  origin_lng: 4.5421,
  destination_address: 'Ibadan, Oyo',
  destination_lat: 7.3775,
  destination_lng: 3.947,
  departure_time: '2026-11-07T17:00:00Z',
  booking_closes_at: '2026-11-07T15:00:00Z',
  seats_left: 3,
};

describe('booking closed', () => {
  it('reads the server time and closes only once it has passed', () => {
    const ride = parseRide(raw)!;
    expect(ride.bookingClosesAt).toBe('2026-11-07T15:00:00Z');
    expect(bookingClosed(ride, Date.parse('2026-11-07T14:59:00Z'))).toBe(false);
    expect(bookingClosed(ride, Date.parse('2026-11-07T15:00:00Z'))).toBe(true);
    expect(bookingClosed({ bookingClosesAt: null }, Date.now())).toBe(false); // no time given: stays open
  });

  it('builds "Find a later ride" with the same From, To and a day that is not over', () => {
    const ride = parseRide(raw)!;
    const from = placeOf(ride, 'origin');
    const to = placeOf(ride, 'destination');
    expect(from).toEqual({ name: 'Ilorin', city: 'Ilorin', lat: 8.4966, lng: 4.5421 });
    expect(to?.name).toBe('Ibadan');
    expect(laterRideSearch(from, to, '2026-11-07', 1, '2026-11-07')).toEqual({
      origin: from,
      destination: to,
      date: '2026-11-07',
      seats: 1,
    });
    expect(laterRideSearch(from, to, '2026-11-05', 2, '2026-11-08')?.date).toBe('2026-11-08');
    expect(laterRideSearch(null, to, '2026-11-07')).toBeNull();
  });

  it('recognises the server answer and keeps its message as sent', () => {
    const err = toApiError({
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          detail: {
            error: 'booking_closed',
            closed_at: '2026-11-07T15:00:00+00:00',
            message: 'This ride has already left. Please choose a later ride.',
          },
        },
      },
    });
    expect(err.code).toBe('booking_closed');
    expect(err.message).toBe('This ride has already left. Please choose a later ride.');
  });
});
