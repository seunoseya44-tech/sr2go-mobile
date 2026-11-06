import type { Booking } from '../api/bookings';
import { bookingView, rateTripParams } from '../screens/booking/shared';

describe('the passenger is asked to rate the driver at the end of the trip (6 Nov 2026)', () => {
  it('builds the rating screen details from the booking', () => {
    const b = {
      id: '64',
      rideId: '25',
      status: 'completed',
      driverName: 'Test.O',
      originCity: 'Ilorin',
      destinationCity: 'Kano',
      departureDate: '2026-11-06',
      ride: { driverId: '75' },
      raw: {},
    } as unknown as Booking;
    expect(bookingView(b)).toBe('completed');
    expect(rateTripParams(b)).toMatchObject({
      bookingId: '64',
      revieweeId: '75',
      name: 'Test.O',
      rideId: '25',
    });
    expect(rateTripParams(b).route).toContain('Ilorin → Kano');
  });
});
