import { parseDriverProfile, parseRide, parseRides, parseTicker } from '../api/parsers';
import { naira, shortDate, vehicleLabel } from '../utils/format';

describe('parseRide', () => {
  const sample = {
    id: 42,
    departure_time: '2026-10-03T07:30:00',
    origin_city: 'Lagos',
    destination_city: 'Ibadan',
    vehicle_type: 'Sienna',
    seats_left: 3,
    meeting_point_name: 'Total Filling Station, Ojota',
    meeting_point_address: 'Ikorodu Rd, Ojota, Lagos',
    meeting_point_lat: 6.58,
    meeting_point_lng: 3.37,
    driver_id: 'd1',
    driver_name: 'Chinedu.O',
    driver_rating: 4.8,
    pay_amount: '3900.00',
    usual_fare: '4875.00',
    savings_pct: 20,
    auto_approve: true,
    is_ac: true,
    driver_smokes: false,
    pref_music: 'yes',
    pref_pets: 'ask',
    max_luggage_kg: 20,
    luggage_note: 'one medium bag',
  };

  it('maps the RideOut fields the screens use', () => {
    const ride = parseRide(sample)!;
    expect(ride).toMatchObject({
      id: '42',
      departureDate: '2026-10-03',
      departureTime: '07:30',
      driverName: 'Chinedu.O',
      payAmount: '3900.00',
      usualFare: '4875.00',
      savingsPct: 20,
      autoApprove: true,
      isAc: true,
      prefPets: 'ask',
      maxLuggageKg: 20,
    });
  });

  it('keeps usual fare null on city trips and falls back to display_price', () => {
    const ride = parseRide({ id: 1, display_price: '900', usual_fare: null, savings_pct: null })!;
    expect(ride.payAmount).toBe('900');
    expect(ride.usualFare).toBeNull();
    expect(ride.savingsPct).toBeNull();
  });

  it('parses lists in any of the common envelopes', () => {
    expect(parseRides([sample])).toHaveLength(1);
    expect(parseRides({ rides: [sample] })).toHaveLength(1);
    expect(parseRides({ data: [sample, { no_id: true }] })).toHaveLength(1);
  });
});

describe('parseDriverProfile / parseTicker', () => {
  it('builds only the fields returned', () => {
    const p = parseDriverProfile({
      name: 'Chinedu.O',
      rating: 4.8,
      rides_completed: 126,
      badges: ['Verified driver'],
    });
    expect(p.vehicle).toBeNull();
    expect(p.badges).toEqual(['Verified driver']);
    expect(p.tripsCompleted).toBe(126);
  });

  it('reads the ticker routes', () => {
    const t = parseTicker({
      routes: [
        {
          origin: 'Lagos',
          destination: 'Ibadan',
          price: 3900,
          motor_park_anchor: 4875,
          savings_pct: 20,
        },
      ],
    });
    expect(t[0]).toEqual({
      origin: 'Lagos',
      destination: 'Ibadan',
      price: '3900',
      motorParkAnchor: '4875',
      savingsPct: 20,
    });
  });
});

describe('format helpers for rides', () => {
  it('formats naira without rounding', () => {
    expect(naira('3900.00')).toBe('₦3,900');
    expect(naira('3451.33')).toBe('₦3,451.33');
    expect(naira(null)).toBe('');
  });
  it('formats dates and vehicle labels', () => {
    expect(shortDate('2026-10-03')).toBe('Sat 3 Oct');
    expect(vehicleLabel('Saloon')).toBe('Saloon car');
    expect(vehicleLabel('Hiace')).toBe('Hiace bus');
    expect(vehicleLabel('Sienna')).toBe('Sienna');
  });
});

describe('city routes show the price only', () => {
  it('drops the anchor and badge when the anchor equals the price or savings are 0', () => {
    const t = parseTicker({
      routes: [
        {
          origin: 'Ikeja',
          destination: 'Badagry',
          price: 2350,
          motor_park_anchor: 2350,
          savings_pct: 0,
        },
      ],
    });
    expect(t[0]?.motorParkAnchor).toBeNull();
    expect(t[0]?.savingsPct).toBeNull();
    const ride = parseRide({ id: 9, pay_amount: '900', usual_fare: '900', savings_pct: 0 })!;
    expect(ride.usualFare).toBeNull();
    expect(ride.savingsPct).toBeNull();
  });
});
