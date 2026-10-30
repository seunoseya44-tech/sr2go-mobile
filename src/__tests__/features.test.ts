import { companyIdOf, inviteToken, parseBoardingList, parseReviews } from '../api/features';

describe('30 Oct server features', () => {
  it('reads the driver boarding list', () => {
    const list = parseBoardingList({
      passengers: [
        {
          booking_id: 62,
          passenger_name: 'Test.O',
          passenger_verified: true,
          photo: 'https://x/p.jpg',
          seats_booked: 1,
          driver_code: '6709',
          driver_qr_payload: 'S2G1.abc.def',
          boarding: { driver_checked_passenger_code: true, boarded: false },
        },
      ],
    });
    expect(list[0]).toMatchObject({
      bookingId: '62',
      name: 'Test.O',
      verified: true,
      driverCode: '6709',
      driverQrPayload: 'S2G1.abc.def',
      driverCheckedPassenger: true,
      passengerCheckedDriver: false,
      boarded: false,
    });
  });

  it('reads public reviews with replies and the counts from the server', () => {
    const s = parseReviews({
      user_id: 75,
      total: 1,
      complaints: 0,
      testimonies: 1,
      reviews: [
        {
          id: 3,
          author_name: 'Martin.M',
          body: 'On time',
          is_complaint: false,
          replies: [{ id: 9, body: 'Thanks', reply_type: 'subject_response' }],
        },
      ],
    });
    expect(s.total).toBe(1);
    expect(s.reviews[0]?.replies[0]?.body).toBe('Thanks');
  });

  it('takes the token from a pasted invite link or a bare code', () => {
    expect(inviteToken('https://shareride2go.com/join?token=abc123XYZ')).toBe('abc123XYZ');
    expect(inviteToken('  abc123XYZ ')).toBe('abc123XYZ');
  });

  it('finds the company id on the user', () => {
    expect(companyIdOf({ corporate_id: 4 })).toBe('4');
    expect(companyIdOf({ corporate: { id: 7 } })).toBe('7');
    expect(companyIdOf({})).toBeNull();
  });
});
