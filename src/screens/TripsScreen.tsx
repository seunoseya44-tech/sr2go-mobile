import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { bookingsApi, type Booking } from '../api/bookings';
import { toApiError } from '../api/errors';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Chip, LinkText } from '../components/ui';
import { connectionsApi } from '../api/social';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { shortDate, vehicleLabel } from '../utils/format';
import { bookingView, mmss, useCountdown, VIEW_TEXT, type BookingView } from './booking/shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Tab = 'Upcoming' | 'Completed' | 'Cancelled';

const TAB_OF: Record<BookingView, Tab> = {
  waiting: 'Upcoming',
  payNow: 'Upcoming',
  confirmed: 'Upcoming',
  boarded: 'Upcoming',
  completed: 'Completed',
  requestClosed: 'Cancelled',
  payExpired: 'Cancelled',
  declined: 'Cancelled',
  cancelled: 'Cancelled',
  refunded: 'Cancelled',
};

/** Screen 28 · My trips: Upcoming, Completed, Cancelled from GET /api/rides/bookings/mine. */
export function TripsScreen() {
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<Tab>('Upcoming');
  const query = useQuery({ queryKey: ['bookings'], queryFn: bookingsApi.mine });
  const connections = useQuery({
    queryKey: ['connections'],
    queryFn: connectionsApi.mine,
    retry: false,
  });

  const list = (query.data ?? []).filter((b) => TAB_OF[bookingView(b)] === tab);

  return (
    <Screen topBar={null} scroll={false} testID="trips-screen" contentStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>My trips</Text>
        <View style={styles.links}>
          <LinkText onPress={() => navigation.navigate('CompanionInvites')}>Invitations</LinkText>
          <LinkText onPress={() => navigation.navigate('TransfersInbox')}>Transfers</LinkText>
        </View>
      </View>
      <View style={styles.tabs}>
        {(['Upcoming', 'Completed', 'Cancelled'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: t === tab }}
          >
            <Text style={[styles.tabText, t === tab && styles.tabTextActive]}>{t}</Text>
            {t === tab ? <View style={styles.underline} /> : null}
          </Pressable>
        ))}
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {query.isPending ? (
          <ActivityIndicator color={colors.brand} />
        ) : query.isError ? (
          <>
            <Banner tone="error" message={toApiError(query.error).message} />
            <Button title="Try again" variant="secondary" onPress={() => void query.refetch()} />
          </>
        ) : list.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="car-outline" size={36} color={colors.brand} />
            <Text style={styles.emptyText}>
              {tab === 'Upcoming'
                ? 'Your bookings will appear here once you book a seat.'
                : `No ${tab.toLowerCase()} trips yet.`}
            </Text>
            {tab === 'Upcoming' ? (
              <Button
                title="Find a ride"
                onPress={() => navigation.navigate('Main', { screen: 'Home' })}
              />
            ) : null}
          </View>
        ) : (
          list.map((b) => (
            <BookingCard key={b.id} booking={b} onPress={() => openBooking(navigation, b)} />
          ))
        )}
        {tab === 'Upcoming'
          ? (connections.data ?? [])
              .filter((c) => !['completed', 'closed', 'missed_connection'].includes(c.status))
              .map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => navigation.navigate('ConnectionStatus', { connectionId: c.id })}
                  style={styles.card}
                  accessibilityRole="button"
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.when}>
                      {shortDate(c.legs[0]?.ride?.departureDate)} ·{' '}
                      {c.legs[0]?.ride?.departureTime ?? ''}
                    </Text>
                    <Chip
                      label={c.status.replace(/_/g, ' ')}
                      tone={c.status === 'confirmed' ? 'blue' : 'grey'}
                    />
                  </View>
                  <Text style={styles.meta}>
                    {c.legs[0]?.ride?.originCity} → {c.legs[1]?.ride?.destinationCity} · 1 stop at{' '}
                    {c.hub ?? ''}
                  </Text>
                </Pressable>
              ))
          : null}
      </ScrollView>
    </Screen>
  );
}

function openBooking(navigation: Nav, b: Booking) {
  const view = bookingView(b);
  if (view === 'waiting') navigation.navigate('BookingStatus', { bookingId: b.id });
  else if (view === 'payNow') navigation.navigate('Payment', { bookingId: b.id });
  else if (view === 'completed') {
    navigation.navigate('RateTrip', {
      bookingId: b.id,
      revieweeId: b.ride?.driverId ?? String(b.raw.driver_id ?? ''),
      name: b.driverName,
      route: `${b.originCity ?? ''} → ${b.destinationCity ?? ''} · ${shortDate(b.departureDate)}`,
      rideId: b.rideId,
    });
  } else if (view === 'confirmed' || view === 'boarded') {
    navigation.navigate('BookingConfirmation', { bookingId: b.id });
  } else navigation.navigate('BookingStatus', { bookingId: b.id });
}

function BookingCard({ booking: b, onPress }: { booking: Booking; onPress: () => void }) {
  const view = bookingView(b);
  const text = VIEW_TEXT[view];
  const left = useCountdown(view === 'payNow' ? b.payBy : null);
  const chip = view === 'payNow' && left != null ? `Pay within ${mmss(left)}` : text.chip;
  const line =
    view === 'declined' ? `${b.driverName ?? 'The driver'} couldn't take this booking` : text.line;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.tile }]}
      accessibilityRole="button"
      testID={`booking-${b.id}`}
    >
      <View style={styles.cardTop}>
        <Text style={styles.when}>
          {shortDate(b.departureDate)} · {b.departureTime ?? ''}
        </Text>
        <Chip label={chip} tone={text.tone} />
      </View>
      <Text style={styles.meta}>
        {b.originCity} → {b.destinationCity}
        {b.meetingPointName ? ` · ${b.meetingPointName}` : ''}
      </Text>
      <Text style={styles.meta}>
        {b.driverName ?? 'Driver'}
        {b.vehicle ? ` · ${vehicleLabel(b.vehicle)}` : ''}
      </Text>
      {view === 'completed' ? (
        <Text style={styles.action}>Rate this trip ›</Text>
      ) : view === 'payNow' ? (
        <Text style={styles.action}>Pay to keep your seat ›</Text>
      ) : line ? (
        <Text style={styles.meta}>{line}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 0, gap: spacing.sm, flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  links: { flexDirection: 'row', gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  tabs: { flexDirection: 'row', gap: spacing.lg },
  tab: { paddingVertical: spacing.xs, minHeight: 44, justifyContent: 'center' },
  tabText: { ...typography.body, color: colors.textMuted },
  tabTextActive: { ...typography.bodySemibold, color: colors.text },
  underline: { height: 2, backgroundColor: colors.brand, marginTop: 4, borderRadius: 1 },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  when: { ...typography.bodySemibold, color: colors.text },
  meta: { ...typography.secondary, color: colors.textMuted },
  action: { ...typography.bodyMedium, color: colors.navy, marginTop: spacing.xxs },
});
