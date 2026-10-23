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

import { driverApi, type DriverRide } from '../../api/driver';
import { toApiError } from '../../api/errors';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Chip } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { appMode } from '../../state/mode';
import { colors, radius, spacing, typography } from '../../theme';
import { naira, shortDate } from '../../utils/format';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** Screen 26 · My rides (driver home). Take-home per seat only; no passenger price. */
export function MyRidesScreen() {
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<'Upcoming' | 'Past'>('Upcoming');
  const query = useQuery({ queryKey: ['my-rides'], queryFn: driverApi.myRides });
  const rides = (query.data ?? []).filter((r) =>
    tab === 'Upcoming'
      ? r.status === 'scheduled' || r.status === 'active' || r.status === 'unknown'
      : r.status === 'completed' || r.status === 'cancelled',
  );

  return (
    <Screen topBar={null} scroll={false} testID="my-rides" contentStyle={styles.content}>
      <View style={styles.top}>
        <Text style={styles.title}>My rides</Text>
        <Pressable
          onPress={() => {
            appMode.set('passenger');
            navigation.navigate('Main', { screen: 'Home' });
          }}
          style={styles.pill}
          accessibilityRole="button"
        >
          <Ionicons name="swap-horizontal" size={16} color={colors.navy} />
          <Text style={styles.pillText}>Travelling</Text>
        </Pressable>
      </View>
      <View style={styles.tabs}>
        {(['Upcoming', 'Past'] as const).map((t) => (
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
          <Banner tone="error" message={toApiError(query.error).message} />
        ) : rides.length === 0 ? (
          <Text style={styles.empty}>
            {tab === 'Upcoming' ? 'No upcoming rides. Post one below.' : 'No past rides yet.'}
          </Text>
        ) : (
          rides.map((r) => (
            <RideCard
              key={r.id}
              ride={r}
              onPress={() =>
                navigation.navigate(
                  r.status === 'completed'
                    ? 'JourneyRecord'
                    : r.status === 'active'
                      ? 'ActiveTrip'
                      : 'RideRequests',
                  {
                    rideId: r.id,
                  },
                )
              }
            />
          ))
        )}
        <Button title="Post a ride" onPress={() => navigation.navigate('PostRideRoute')} />
      </ScrollView>
    </Screen>
  );
}

function RideCard({ ride: r, onPress }: { ride: DriverRide; onPress: () => void }) {
  const chip =
    r.status === 'active'
      ? { label: 'On the road', tone: 'blue' as const }
      : r.requestsPending
        ? {
            label: `${r.requestsPending} request${r.requestsPending === 1 ? '' : 's'}`,
            tone: 'solid' as const,
          }
        : r.status === 'completed'
          ? { label: 'Completed', tone: 'grey' as const }
          : r.status === 'cancelled'
            ? { label: 'Cancelled', tone: 'grey' as const }
            : { label: 'Upcoming', tone: 'grey' as const };
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.tile }]}
      accessibilityRole="button"
    >
      <View style={styles.cardTop}>
        <Text style={styles.when}>
          {shortDate(r.departureDate)} · {r.departureTime ?? ''}
        </Text>
        <Chip label={chip.label} tone={chip.tone} />
      </View>
      <Text style={styles.meta}>
        {r.originCity} → {r.destinationCity}
        {r.meetingPointName ? ` · ${r.meetingPointName}` : ''}
      </Text>
      {r.seatsTotal != null ? (
        <Text style={styles.meta}>
          {r.seatsBooked ?? 0} of {r.seatsTotal} seats booked
        </Text>
      ) : null}
      {r.priceLines.length ? (
        r.priceLines.map((l) => (
          <Text key={l} style={styles.take}>
            {l}
          </Text>
        ))
      ) : r.takeHomePerSeat ? (
        <Text style={styles.take}>You receive {naira(r.takeHomePerSeat)} per seat</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 0, gap: spacing.sm, flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.title, color: colors.text },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.tile,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    minHeight: 36,
  },
  pillText: { ...typography.secondary, color: colors.navy },
  tabs: { flexDirection: 'row', gap: spacing.lg },
  tab: { paddingVertical: spacing.xs, minHeight: 44, justifyContent: 'center' },
  tabText: { ...typography.body, color: colors.textMuted },
  tabTextActive: { ...typography.bodySemibold, color: colors.text },
  underline: { height: 2, backgroundColor: colors.brand, marginTop: 4, borderRadius: 1 },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
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
  take: { ...typography.body, color: colors.navy, marginTop: spacing.xxs },
});
