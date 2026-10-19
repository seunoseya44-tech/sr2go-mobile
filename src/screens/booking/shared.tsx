import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Booking } from '../../api/bookings';
import { Chip } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';
import { shortDate } from '../../utils/format';

/** "Lagos → Ibadan · Fri 3 Oct, 07:30" */
export function tripLine(b: Booking): string {
  const when = [shortDate(b.departureDate), b.departureTime].filter(Boolean).join(', ');
  return `${b.originCity ?? ''} → ${b.destinationCity ?? ''}${when ? ` · ${when}` : ''}`;
}

export function routeLine(b: Booking): string {
  return `${b.originCity ?? ''} → ${b.destinationCity ?? ''}`;
}

/** Seconds left until `iso`, never negative; null when there is no deadline. */
export function useCountdown(iso: string | null): number | null {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!iso) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [iso]);
  // `tick` only forces a re-render each second; the value is derived from the clock.
  void tick;
  return secondsLeft(iso);
}

function secondsLeft(iso: string | null): number | null {
  if (!iso) return null;
  const end = Date.parse(iso);
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.floor((end - Date.now()) / 1000));
}

export function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * The state a passenger sees, derived only from fields the backend sends
 * (status, payment_status, accepted_at, pay_by). Labels from the brief's
 * value reference and the Trips wireframe.
 */
export type BookingView =
  | 'waiting'
  | 'payNow'
  | 'confirmed'
  | 'boarded'
  | 'completed'
  | 'requestClosed'
  | 'payExpired'
  | 'declined'
  | 'cancelled'
  | 'refunded';

export function bookingView(b: Booking): BookingView {
  if (b.status === 'completed') return 'completed';
  if (b.status === 'rejected') return 'declined';
  if (b.status === 'cancelled') {
    if (b.paymentStatus === 'refunded') return 'refunded';
    if (b.acceptedAt) return 'payExpired';
    return b.raw.cancelled_by_passenger === true ? 'cancelled' : 'requestClosed';
  }
  if (b.status === 'pending') return 'waiting';
  if (b.paymentStatus === 'paid') return b.raw.boarded === true ? 'boarded' : 'confirmed';
  if (b.payBy && Date.parse(b.payBy) < Date.now()) return 'payExpired';
  return 'payNow';
}

export const VIEW_TEXT: Record<
  BookingView,
  { chip: string; tone: 'blue' | 'grey' | 'amber'; line?: string }
> = {
  waiting: { chip: 'Waiting for driver', tone: 'grey' },
  payNow: { chip: 'Pay to keep your seat', tone: 'amber' },
  confirmed: { chip: 'Confirmed · Paid', tone: 'blue' },
  boarded: { chip: 'Boarded', tone: 'blue' },
  completed: { chip: 'Completed', tone: 'blue' },
  requestClosed: { chip: 'Closed', tone: 'grey', line: 'Request closed. You were not charged.' },
  payExpired: {
    chip: 'Closed',
    tone: 'grey',
    line: 'The time to pay has passed. Your seat was released.',
  },
  declined: { chip: 'Declined', tone: 'grey' },
  cancelled: { chip: 'Cancelled', tone: 'grey' },
  refunded: { chip: 'Refunded', tone: 'grey' },
};

/** Four-row summary used on the waiting and cancel screens. */
export function SummaryCard({ booking, status }: { booking: Booking; status: string }) {
  const rows: [string, React.ReactNode][] = [
    ['Trip', routeLine(booking)],
    [
      'Departs',
      [shortDate(booking.departureDate), booking.departureTime].filter(Boolean).join(', '),
    ],
    [
      'Seats',
      booking.children > 0
        ? `1 + ${booking.children} child${booking.children === 1 ? '' : 'ren'}`
        : String(booking.seatsBooked),
    ],
    ['Status', <Chip key="s" label={status} tone="blue" />],
  ];
  return (
    <View style={styles.card}>
      {rows.map(([k, v]) => (
        <View key={k} style={styles.kv}>
          <Text style={styles.k}>{k}</Text>
          {typeof v === 'string' ? <Text style={styles.v}>{v}</Text> : v}
        </View>
      ))}
    </View>
  );
}

export function ResultIcon({
  icon,
  tone = 'grey',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'blue' | 'grey' | 'red';
}) {
  const bg = tone === 'blue' ? colors.brand : tone === 'red' ? colors.dangerSoft : colors.tile;
  const fg = tone === 'blue' ? colors.textOnBrand : tone === 'red' ? colors.danger : colors.navy;
  return (
    <View style={[styles.resultIcon, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={40} color={fg} />
    </View>
  );
}

export const shared = StyleSheet.create({
  centered: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl },
  heading: { ...typography.title, color: colors.text, textAlign: 'center' },
  body: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  small: { ...typography.secondary, color: colors.textMuted, textAlign: 'center' },
  subtitle: { ...typography.secondary, color: colors.textMuted },
  overline: { ...typography.overline, color: colors.textMuted, textTransform: 'uppercase' },
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  k: { ...typography.body, color: colors.textMuted },
  v: { ...typography.body, color: colors.text, flexShrink: 1, textAlign: 'right' },
  resultIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
