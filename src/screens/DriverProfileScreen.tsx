import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { toApiError } from '../api/errors';
import { ridesApi } from '../api/rides';
import { Banner } from '../components/Banner';
import { Screen } from '../components/Screen';
import { Avatar, Card, Chip, Overline } from '../components/ui';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';

function memberSince(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
}

/** Screen 10: Driver public profile. Shows only what the endpoint returns. */
export function DriverProfileScreen() {
  const { params } = useRoute<RouteProp<AppStackParamList, 'DriverProfile'>>();
  const query = useQuery({
    queryKey: ['driver', params.driverId],
    queryFn: () => ridesApi.driverProfile(params.driverId),
  });

  const p = query.data;
  const since = memberSince(p?.memberSince ?? null);

  return (
    <Screen testID="driver-profile">
      {query.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : query.isError ? (
        <Banner tone="error" message={toApiError(query.error).message} />
      ) : (
        <>
          <View style={styles.header}>
            <Avatar
              name={p?.name ?? params.name ?? null}
              size={88}
              verified={p?.isVerified === true}
            />
            <Text style={styles.name}>{p?.name ?? params.name ?? 'Driver'}</Text>
            {since ? <Text style={styles.meta}>Member since {since}</Text> : null}
          </View>

          {p && p.badges.length > 0 ? (
            <View style={styles.badges}>
              {p.badges.map((b) => (
                <Chip
                  key={b}
                  label={b}
                  tone="blue"
                  icon={/verified/i.test(b) ? 'shield-checkmark-outline' : undefined}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.stats}>
            {p?.rating != null ? (
              <View style={styles.stat}>
                <Text style={styles.statValue}>{p.rating.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            ) : null}
            {p?.tripsCompleted != null ? (
              <View style={styles.stat}>
                <Text style={styles.statValue}>{p.tripsCompleted}</Text>
                <Text style={styles.statLabel}>Trips done</Text>
              </View>
            ) : null}
          </View>

          {p?.vehicle ? (
            <View style={styles.section}>
              <Overline>Vehicle</Overline>
              <Card>
                <View style={styles.row}>
                  <Ionicons name="car-outline" size={22} color={colors.navy} />
                  <View style={styles.flex}>
                    <Text style={styles.vehicle}>{p.vehicle}</Text>
                    <Text style={styles.meta}>Plate shown after you pay</Text>
                  </View>
                </View>
              </Card>
            </View>
          ) : null}

          <Text style={styles.footnote}>
            Ratings come from passengers who travelled with this driver.
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', paddingVertical: spacing.xxl },
  header: { alignItems: 'center', gap: spacing.xs },
  name: { ...typography.title, color: colors.text },
  meta: { ...typography.secondary, color: colors.textMuted },
  badges: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.tile,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { ...typography.price, color: colors.text },
  statLabel: { ...typography.secondary, color: colors.textMuted },
  section: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vehicle: { ...typography.bodySemibold, color: colors.text },
  footnote: { ...typography.secondary, color: colors.textMuted },
});
