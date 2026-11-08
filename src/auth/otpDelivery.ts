/**
 * Fix c (7 Nov): the phone-code screen says "sent" only when the server says
 * a code was sent, and says where (SMS or email). Martin's 13 Oct spec: the
 * server reports this in `otp_sent_to`; "We could not send your code - tap
 * Resend" when it was not sent. Staging may return the code itself in the
 * answer (no SMS there); test builds show it so the tester can go on.
 *
 * The answers of register and resend-otp are read here. Field names other than
 * `otp_sent_to` are read defensively until the server's are confirmed.
 */
import { unwrap } from '../api/parsers';
import { env } from '../config/env';

export type OtpChannel = 'sms' | 'email' | 'whatsapp';

export interface OtpDelivery {
  /** true = server says sent, false = server says not sent, null = server said nothing. */
  sent: boolean | null;
  channel: OtpChannel | null;
  /** Masked address the server gives (e.g. "a•••@example.com"), shown as sent. */
  to: string | null;
  /** Staging only: the code returned in the answer. Never shown on the live server. */
  testCode: string | null;
}

const UNKNOWN: OtpDelivery = { sent: null, channel: null, to: null, testCode: null };

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function channelOf(v: string | null): OtpChannel | null {
  if (!v) return null;
  const s = v.toLowerCase();
  if (s.includes('@') || s === 'email' || s === 'mail') return 'email';
  if (s.includes('whatsapp')) return 'whatsapp';
  if (s === 'sms' || s === 'phone' || s === 'text' || /^\+?[\d•*x\s-]{6,}$/.test(s)) return 'sms';
  return null;
}

export function parseOtpDelivery(payload: unknown, isStaging = env.isStaging): OtpDelivery {
  const s = unwrap(payload);
  const nested = unwrap(s.otp);
  const sentTo = text(s.otp_sent_to) ?? text(nested.sent_to);
  const channelText = text(s.otp_channel) ?? text(s.otp_sent_via) ?? text(nested.channel) ?? sentTo;
  const channel = channelOf(channelText);
  const flag = [s.otp_sent, s.sms_sent, nested.sent].find((v) => typeof v === 'boolean') as
    boolean | undefined;
  const sent = flag ?? (sentTo || channel ? true : null);
  const to =
    sentTo && channelOf(sentTo) && !/^(sms|email|phone|whatsapp)$/i.test(sentTo) ? sentTo : null;
  const raw = [s.otp_code, s.dev_otp, s.debug_otp, nested.code, s.otp]
    .map((v) => (typeof v === 'number' ? String(v) : text(v)))
    .find((v) => !!v && /^\d{4,8}$/.test(v));
  return { sent, channel, to, testCode: isStaging ? (raw ?? null) : null };
}

/** The last answer, handed from sign-up to the code screen. */
let last: OtpDelivery = UNKNOWN;
export const otpDelivery = {
  get: (): OtpDelivery => last,
  set: (d: OtpDelivery) => {
    last = d;
  },
  clear: () => {
    last = UNKNOWN;
  },
};

/** The line under "Enter the code". */
export function otpSubtitle(d: OtpDelivery, maskedPhone: string, expiryMinutes: number): string {
  const expiry = ` It expires in ${expiryMinutes} minutes.`;
  if (d.sent === false) return 'We could not send your code - tap Resend.';
  if (d.sent === true) {
    if (d.channel === 'email')
      return `We sent a 6-digit code to your email${d.to ? ` (${d.to})` : ''}.${expiry}`;
    if (d.channel === 'whatsapp')
      return `We sent a 6-digit code by WhatsApp to ${d.to ?? maskedPhone}.${expiry}`;
    return `We sent a 6-digit code by SMS to ${d.to ?? maskedPhone}.${expiry}`;
  }
  return `Enter the 6-digit code for ${maskedPhone}. If no code arrives, tap Resend.`;
}
