import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { toApiError } from '../api/errors';
import { ridesApi } from '../api/rides';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { RideCard } from '../components/RideCard';
import { Screen } from '../components/Screen';
import { Card, RoadLine } from '../components/ui';
import type { AppStackParamList } from '../navigation/types';
import { searchForm } from '../state/searchForm';
import { colors, spacing, typography } from '../theme';
import { addDays, shortDate } from '../utils/format';

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
      ) : query.data.length === 0 ? (
        <View style={styles.empty} testID="empty-results">
          <View style={styles.emptyArt}>
            <RoadLine length={120} />
          </View>
          <Text style={styles.emptyTitle}>No rides yet for this route and date</Text>
          <Text style={styles.emptyBody}>Drivers post new rides every day. Try another date.</Text>
          <Button title="Change date" onPress={() => changeDate(1)} testID="change-date" />
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
            {query.data.length} ride{query.data.length === 1 ? '' : 's'} found
          </Text>
          {query.data.map((ride) => (
            <RideCard
              key={ride.id}
              ride={ride}
              onPress={() => navigation.navigate('RideDetails', { rideId: ride.id })}
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
    ...typography.title,
    fontSize: 22,
    lineHeight: 28,
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
