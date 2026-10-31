import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { toApiError } from '../api/errors';
import { ridesApi } from '../api/rides';
import { connectionsApi } from '../api/social';
import { ConnectionCard, setConnectionOptions } from './connections/ConnectionScreens';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { RideCard } from '../components/RideCard';
import { Screen } from '../components/Screen';
import { Card, RoadLine } from '../components/ui';
import type { AppStackParamList } from '../navigation/types';
import { searchForm } from '../state/searchForm';
import { colors, spacing, typography } from '../theme';
import { addDays, shortDate } from '../utils/format';
import { featuresApi } from '../api/features';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** Screen 08: Search results, with the empty state from the brief. */
export function SearchResultsScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'SearchResults'>>();
  const search = params.params;

  const query = useQuery({
    queryKey: ['rides', search],
    queryFn: () => ridesApi.search(search),
  });
  const connections = useQuery({
    queryKey: ['connections-search', search],
    queryFn: async () => {
      const options = await connectionsApi.search({
        originLat: search.origin.lat,
        originLng: search.origin.lng,
        destLat: search.destination.lat,
        destLng: search.destination.lng,
        date: search.date,
        seats: search.seats,
      });
      setConnectionOptions(options);
      return options;
    },
    retry: false,
  });
  const options = connections.data ?? [];

  const [alertNote, setAlertNote] = useState<string | null>(null);
  const alert = useMutation({
    mutationFn: () =>
      featuresApi.createAlert({
        originLat: search.origin.lat,
        originLng: search.origin.lng,
        originAddress: search.origin.name,
        destinationLat: search.destination.lat,
        destinationLng: search.destination.lng,
        destinationAddress: search.destination.name,
        travelDate: search.date,
        seatsNeeded: search.seats,
      }),
    onSuccess: setAlertNote,
    onError: (e) => setAlertNote(toApiError(e).message),
  });
  const seatsLabel = `${search.seats} seat${search.seats === 1 ? '' : 's'}`;

  const changeDate = (days: number) => {
    const date = addDays(search.date, days);
    searchForm.set({ date });
    navigation.setParams({ params: { ...search, date } });
  };

  return (
    <Screen testID="search-results" contentStyle={styles.content}>
      <Card onPress={() => navigation.goBack()} testID="search-summary" style={styles.summary}>
        <View style={styles.summaryText}>
          <Text style={styles.route}>
            {search.origin.city} → {search.destination.city}
          </Text>
          <Text style={styles.meta}>
            {shortDate(search.date)} · {seatsLabel}
          </Text>
        </View>
        <Ionicons name="pencil-outline" size={20} color={colors.navy} />
      </Card>

      {query.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.meta}>Finding rides…</Text>
        </View>
      ) : query.isError ? (
        <View style={styles.gap}>
          <Banner tone="error" message={toApiError(query.error).message} />
          <Button title="Try again" variant="secondary" onPress={() => void query.refetch()} />
        </View>
      ) : query.data.length === 0 && options.length === 0 ? (
        <View style={styles.empty} testID="empty-results">
          <View style={styles.emptyArt}>
            <RoadLine length={120} />
          </View>
          <Text style={styles.emptyTitle}>No rides yet for this route and date</Text>
          <Text style={styles.emptyBody}>Drivers post new rides every day. Try another date.</Text>
          <Button
            title="Alert me when a ride is posted"
            icon="notifications-outline"
            onPress={() => alert.mutate()}
            loading={alert.isPending}
          />
          {alertNote ? <Banner tone="info" message={alertNote} /> : null}
          <Button
            title="Change date"
            variant="secondary"
            onPress={() => changeDate(1)}
            testID="change-date"
          />
          <Button
            title="Change route"
            variant="secondary"
            onPress={() => navigation.goBack()}
            testID="change-route"
          />
        </View>
      ) : (
        <View style={styles.gap}>
          <Text style={styles.count} testID="results-count">
            {query.data.length === 0
              ? 'No direct rides. Travel with one stop:'
              : `${query.data.length} direct ride${query.data.length === 1 ? '' : 's'}`}
          </Text>
          {query.data.map((ride) => (
            <RideCard
              key={ride.id}
              ride={ride}
              onPress={() => navigation.navigate('RideDetails', { rideId: ride.id })}
            />
          ))}
          {options.length > 0 && query.data.length > 0 ? (
            <Text style={styles.count}>With one stop</Text>
          ) : null}
          {options.map((o, i) => (
            <ConnectionCard
              key={o.rideIds.join('-')}
              option={o}
              onPress={() => navigation.navigate('ConnectionDetails', { index: i })}
            />
          ))}
          <Pressable
            onPress={() => changeDate(1)}
            style={styles.nextDay}
            accessibilityRole="button"
          >
            <Text style={styles.nextDayText}>See {shortDate(addDays(search.date, 1))}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.navy} />
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  gap: { gap: spacing.sm },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryText: { flex: 1, gap: 2 },
  route: { ...typography.heading, color: colors.text },
  meta: { ...typography.secondary, color: colors.textMuted },
  count: { ...typography.secondary, color: colors.textMuted },
  center: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
    alignSelf: 'stretch',
  },
  emptyArt: { paddingVertical: spacing.lg },
  emptyTitle: {
    ...typography.screenTitle,
    color: colors.text,
    textAlign: 'center',
  },
  emptyBody: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  nextDay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 44,
  },
  nextDayText: { ...typography.bodyMedium, color: colors.navy },
});
