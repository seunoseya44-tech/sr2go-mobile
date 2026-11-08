import { rideBody } from '../api/driver';
import {
  EVERY_DAY,
  MON_FRI,
  daysText,
  parseRepeatRide,
  toggleDay,
  weekdayOf,
} from '../repeat/repeatRides';

describe('repeat rides: choosing the days (Martin, 8 Nov 2026)', () => {
  it('turns a day on and off and keeps the list in order', () => {
    expect(toggleDay([0, 4], 2)).toEqual([0, 2, 4]);
    expect(toggleDay([0, 2, 4], 2)).toEqual([0, 4]);
    expect(toggleDay([], 6)).toEqual([6]);
  });

  it('says the days the way a driver reads them', () => {
    expect(daysText(MON_FRI)).toBe('Monday to Friday');
    expect(daysText(EVERY_DAY)).toBe('Every day');
    expect(daysText([0])).toBe('Every Monday');
    expect(daysText([1])).toBe('Every Tuesday');
    expect(daysText([0, 2])).toBe('Monday, Wednesday');
    expect(daysText([])).toBe('No days chosen');
  });

  it('counts weekdays from Monday = 0, as the server does', () => {
    expect(weekdayOf('2026-11-09')).toBe(0); // a Monday
    expect(weekdayOf('2026-11-08')).toBe(6); // a Sunday
  });
});

describe('repeat rides: what the server sends back', () => {
  it('reads a schedule with its next rides', () => {
    const r = parseRepeatRide({
      id: 7,
      status: 'paused',
      pause_message: 'the last rides that had passengers were cancelled or did not start',
      days: [0, 1, 2, 3, 4],
      days_text: 'Monday to Friday',
      local_time: '07:00',
      end_date: '2027-02-09',
      origin_address: 'Port Harcourt, Rivers',
      destination_address: 'Aba, Abia',
      total_seats: 4,
      price_per_seat: 2000,
      next_rides: [
        { ride_id: 51, departure_time: '2026-11-10T06:00:00Z', seats_left: 2, seats_booked: 2 },
      ],
    });
    expect(r).not.toBeNull();
    expect(r!.id).toBe('7');
    expect(r!.status).toBe('paused');
    expect(r!.daysText).toBe('Monday to Friday');
    expect(r!.time).toBe('07:00');
    expect(r!.nextRides).toEqual([
      { rideId: '51', departureTime: '2026-11-10T06:00:00Z', seatsLeft: 2, seatsBooked: 2 },
    ]);
  });

  it('ignores an answer without an id and unknown days', () => {
    expect(parseRepeatRide({})).toBeNull();
    expect(parseRepeatRide({ id: 1, days: [0, 9, -1] })!.days).toEqual([0]);
  });
});

describe('a repeat ride sends the same ride as a single post', () => {
  it('builds one ride body for both', () => {
    const body = rideBody({
      route: {
        originLat: 4.8,
        originLng: 7.0,
        originCity: 'Port Harcourt',
        destLat: 5.1,
        destLng: 7.3,
        destCity: 'Aba',
      } as never,
      originName: 'Port Harcourt',
      destName: 'Aba',
      date: '2026-11-10',
      time: '07:00',
      seats: 4,
      car: 'Toyota Corolla',
      meetingPoint: { name: 'Total', address: 'Aba Road', lat: 4.82, lng: 7.03 },
      driverPrice: '2000',
      priceAcknowledged: true,
      autoApprove: true,
      isAc: false,
      prefMusic: 'yes',
      prefPets: 'ask',
      prefChat: 'yes',
      prefSmoking: 'no',
      driverSmokes: false,
      maxLuggageKg: 20,
      luggageNote: '',
      notes: '',
    });
    expect(body.price_per_seat).toBe(2000);
    expect(String(body.departure_time)).toMatch(/^2026-11-10T07:00:00[+-]\d{2}:\d{2}$/);
    expect(body.meeting_point_name).toBe('Total');
    expect(body.luggage_note).toBeNull();
  });
});
