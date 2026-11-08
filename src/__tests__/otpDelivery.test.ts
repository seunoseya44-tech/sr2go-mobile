import { otpSubtitle, parseOtpDelivery } from '../auth/otpDelivery';

describe('phone code delivery (fix c, 7 Nov)', () => {
  it('says sent only when the server says so', () => {
    expect(parseOtpDelivery({}, false).sent).toBeNull();
    expect(otpSubtitle(parseOtpDelivery({}, false), '+234•••89', 10)).toBe(
      'Enter the 6-digit code for +234•••89. If no code arrives, tap Resend.',
    );
    const notSent = parseOtpDelivery({ otp_sent: false }, false);
    expect(otpSubtitle(notSent, '+234•••89', 10)).toBe('We could not send your code - tap Resend.');
  });

  it('says where the code went', () => {
    const email = parseOtpDelivery({ otp_sent_to: 'a•••@example.com' }, false);
    expect(email).toMatchObject({ sent: true, channel: 'email', to: 'a•••@example.com' });
    expect(otpSubtitle(email, '+234•••89', 10)).toBe(
      'We sent a 6-digit code to your email (a•••@example.com). It expires in 10 minutes.',
    );
    const sms = parseOtpDelivery({ data: { otp_sent_to: 'sms' } }, false);
    expect(otpSubtitle(sms, '+234•••89', 10)).toBe(
      'We sent a 6-digit code by SMS to +234•••89. It expires in 10 minutes.',
    );
  });

  it('shows a returned code on staging only', () => {
    expect(parseOtpDelivery({ otp_code: '123456' }, true).testCode).toBe('123456');
    expect(parseOtpDelivery({ otp_code: '123456' }, false).testCode).toBeNull();
  });
});
