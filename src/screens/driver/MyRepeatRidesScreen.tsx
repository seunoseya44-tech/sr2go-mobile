import { useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { toApiError } from '../../api/errors';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Chip } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { repeatRidesApi, type RepeatRide } from '../../repeat/repeatRides';
import { colors, radius, spacing, typography } from '../../theme';
import { naira, shortDate } from '../../utils/format';
import { lagosDateTime } from '../../utils/time';
import { shared } from '../booking/shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** 8 Nov 2026: the driver's repeat rides - days, time, the next rides with seats booked; pause, resume, stop. */
export function MyRepeatRidesScreen() {
  const navigation = useNavigation<Nav>();
  const query = useQuery({ queryKey: ['repeat-rides'], queryFn: repeatRidesApi.mine });
  const list = query.data ?? [];

  return (
    <Screen
      testID="my-repeat-rides"
      topBar={{ title: 'My repeat rides' }}
      scroll={false}
      footer={
        <Button title="New repeat ride" onPress={() => navigation.navigate('PostRideRoute')} />
      }
    >
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
        }
      >
        {query.isLoading ? <ActivityIndicator color={colors.brand} /> : null}
        {query.isError ? <Banner tone="error" message={toApiError(query.error).message} /> : null}
        {!query.isLoading && !query.isError && list.length === 0 ? (
          <Text style={shared.subtitle}>
            No repeat rides yet. When you post a ride, switch on “Repeat this ride” and choose the
            days.
          </Text>
        ) : null}
        {list.map((r) => (
          <RepeatCard key={r.id} ride={r} />
        ))}
      </ScrollView>
    </Screen>
  );
}

function RepeatCard({ ride }: { ride: RepeatRide }) {
  const queryClient = useQueryClient();
  const [confirmStop, setConfirmStop] = useState(false);
  const act = useMutation({
    mutationFn: (action: 'pause' | 'resume' | 'stop') => repeatRidesApi.act(ride.id, action),
    onSuccess: () => {
      setConfirmStop(false);
      void queryClient.invalidateQueries({ queryKey: ['repeat-rides'] });
      void queryClient.invalidateQueries({ queryKey: ['my-rides'] });
    },
  });
  const paused = ride.status === 'paused';

  return (
    <View style={styles.card} testID={`repeat-${ride.id}`}>
      <View style={styles.head}>
        <Text style={styles.route} numberOfLines={2}>
          {town(ride.origin)} → {town(ride.destination)}
        </Text>
        <Chip label={paused ? 'Paused' : 'Active'} tone={paused ? 'amber' : 'blue'} />
      </View>
      <Text style={styles.when}>
        {ride.daysText} at {ride.time}
      </Text>
      <Text style={shared.subtitle}>
        {[
          ride.seats ? `${ride.seats} seats` : null,
          ride.takeHomePerSeat ? `${naira(ride.takeHomePerSeat)} take-home per seat` : null,
          ride.endDate ? `until ${shortDate(ride.endDate)}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {paused && ride.pauseMessage ? (
        <Banner tone="warning" message={`Paused: ${ride.pauseMessage}.`} />
      ) : null}
      {ride.nextRides.length ? (
        <View style={styles.next}>
          <Text style={shared.overline}>Next rides</Text>
          {ride.nextRides.map((n) => {
            const t = lagosDateTime(n.departureTime);
            return (
              <Text key={n.rideId} style={styles.nextLine}>
                {shortDate(n.departureTime)}
                {t.time ? `, ${t.time}` : ''} · {n.seatsBooked} booked
              </Text>
            );
          })}
        </View>
      ) : !paused ? (
        <Text style={shared.subtitle}>SR2Go posts the coming rides for you automatically.</Text>
      ) : null}
      {act.isError ? <Banner tone="error" message={toApiError(act.error).message} /> : null}
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            title={paused ? 'Resume' : 'Pause'}
            variant="secondary"
            onPress={() => act.mutate(paused ? 'resume' : 'pause')}
            loading={act.isPending && act.variables !== 'stop'}
          />
        </View>
        <View style={styles.flex}>
          <Button
            title={confirmStop ? 'Tap again to stop' : 'Stop'}
            variant="secondary"
            onPress={() => (confirmStop ? act.mutate('stop') : setConfirmStop(true))}
            loading={act.isPending && act.variables === 'stop'}
            testID={`repeat-stop-${ride.id}`}
          />
        </View>
      </View>
      <Text style={styles.small}>
        Pause and Stop close only rides nobody has booked. A booked ride stays: drive it, or cancel
        it in My rides.
      </Text>
    </View>
  );
}

function town(address: string): string {
  return (address.split(',')[0] ?? '').trim() || address;
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingBottom: spacing.xl },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  route: { ...typography.bodySemibold, color: colors.text, flex: 1 },
  when: { ...typography.bodyMedium, color: colors.navy },
  next: { gap: spacing.xs },
  nextLine: { ...typography.body, color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  small: { ...typography.secondary, color: colors.textMuted },
});
