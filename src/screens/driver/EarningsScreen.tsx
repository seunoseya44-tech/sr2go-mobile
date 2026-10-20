import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { driverApi } from '../../api/driver';
import { tripApi } from '../../api/trip';
import { toApiError } from '../../api/errors';
import { Banner } from '../../components/Banner';
import { Screen } from '../../components/Screen';
import { Chip, InfoBanner } from '../../components/ui';
import { colors, radius, spacing, typography } from '../../theme';
import { naira, shortDate } from '../../utils/format';
import { shared } from '../booking/shared';

/** Earnings tab: each payout with its status from GET /api/escrow/me. */
export function EarningsScreen() {
  const query = useQuery({ queryKey: ['earnings'], queryFn: driverApi.earnings });
  const strikes = useQuery({ queryKey: ['strikes'], queryFn: tripApi.strikes, retry: false });
  return (
    <Screen topBar={null} testID="earnings">
      <Text style={styles.title}>Earnings</Text>
      <InfoBanner>Payout arrives 24–48 hours after trip completion.</InfoBanner>
      {strikes.data ? (
        <View style={styles.card}>
          <View style={styles.top}>
            <Text style={styles.semi}>Strikes</Text>
            <Chip
              label={String(strikes.data.count ?? 0)}
              tone={strikes.data.count ? 'amber' : 'grey'}
            />
          </View>
          {strikes.data.items.map((s) => (
            <Text key={s.id} style={shared.subtitle}>
              {[s.reason, s.date ? shortDate(s.date) : null, s.status].filter(Boolean).join(' · ')}
            </Text>
          ))}
          {strikes.data.items.length === 0 ? (
            <Text style={shared.subtitle}>
              {strikes.data.message ?? 'No strikes on your account.'}
            </Text>
          ) : null}
        </View>
      ) : null}
      {query.isPending ? (
        <ActivityIndicator color={colors.brand} />
      ) : query.isError ? (
        <Banner tone="error" message={toApiError(query.error).message} />
      ) : query.data.length === 0 ? (
        <Text style={shared.subtitle}>
          No payouts yet. Complete a ride to see your earnings here.
        </Text>
      ) : (
        query.data.map((p) => (
          <View key={p.id} style={styles.card}>
            <View style={styles.top}>
              <Text style={styles.amount}>{p.amount ? naira(p.amount) : '—'}</Text>
              {p.status ? <Chip label={p.status.replace(/_/g, ' ')} tone="grey" /> : null}
            </View>
            {p.route ? <Text style={shared.subtitle}>{p.route}</Text> : null}
            {p.date ? <Text style={shared.subtitle}>{shortDate(p.date)}</Text> : null}
            {p.message ? <Text style={shared.subtitle}>{p.message}</Text> : null}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { ...typography.price, color: colors.text },
  semi: { ...typography.bodySemibold, color: colors.text },
});
