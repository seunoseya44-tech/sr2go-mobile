import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { bookingsApi } from '../../api/bookings';
import { toApiError } from '../../api/errors';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { InfoBanner } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { naira } from '../../utils/format';
import { bookingView, ResultIcon, shared, SummaryCard, VIEW_TEXT } from './shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * Cancel request / Cancel booking (E3). The refund preview comes from
 * GET /api/cancellations/policy; the app never calculates refunds.
 */
export function CancelBookingScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'CancelBooking'>>();
  const queryClient = useQueryClient();
  const booking = useQuery({
    queryKey: ['bookings', params.bookingId],
    queryFn: () => bookingsApi.get(params.bookingId),
  });
  const policy = useQuery({
    queryKey: ['cancel-policy', params.bookingId],
    queryFn: () => bookingsApi.cancellationPolicy(params.bookingId),
    retry: false,
  });
  const [done, setDone] = useState<{
    cash: string | null;
    credit: string | null;
    message: string | null;
  } | null>(null);

  const cancel = useMutation({
    mutationFn: () => bookingsApi.cancel(params.bookingId),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setDone({ cash: r.cashRefund, credit: r.creditRefund, message: r.message });
    },
  });

  const b = booking.data ?? null;
  const goTrips = () => navigation.navigate('Main', { screen: 'Trips' });
  const paid = b?.paymentStatus === 'paid';
  const title = paid ? 'Cancel booking' : 'Cancel request';

  if (done) {
    return (
      <Screen
        testID="cancel-booking"
        topBar={null}
        footer={<Button title="Back to my trips" onPress={goTrips} />}
      >
        <View style={shared.centered}>
          <ResultIcon icon="checkmark" tone="blue" />
          <Text style={shared.heading}>{paid ? 'Booking cancelled' : 'Request cancelled'}</Text>
          {done.message ? <Text style={shared.body}>{done.message}</Text> : null}
          {done.cash ? <Row k="Back to your card" v={naira(done.cash)} /> : null}
          {done.credit ? <Row k="Back to your SR2Go wallet" v={naira(done.credit)} /> : null}
          {!paid ? <Text style={shared.body}>You were not charged.</Text> : null}
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      testID="cancel-booking"
      topBar={{ title }}
      footer={
        <>
          <Button title="Keep my booking" onPress={() => navigation.goBack()} />
          <Button
            title={paid ? 'Cancel and refund' : 'Cancel request'}
            variant="danger"
            onPress={() => cancel.mutate()}
            loading={cancel.isPending}
            disabled={!b || policy.data?.canCancel === false}
            testID="confirm-cancel"
          />
        </>
      }
    >
      {cancel.isError ? <Banner tone="error" message={toApiError(cancel.error).message} /> : null}
      {!b ? (
        <View style={shared.centered}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <>
          <SummaryCard booking={b} status={VIEW_TEXT[bookingView(b)].chip} />
          {paid ? (
            policy.isPending ? (
              <ActivityIndicator color={colors.brand} />
            ) : policy.isError ? (
              <Banner tone="error" message={toApiError(policy.error).message} />
            ) : (
              <View style={styles.tile}>
                <Text style={shared.overline}>If you cancel now</Text>
                {policy.data?.cashRefund ? (
                  <Row k="Back to your card" v={naira(policy.data.cashRefund)} />
                ) : null}
                {policy.data?.creditRefund ? (
                  <Row k="Back to your SR2Go wallet" v={naira(policy.data.creditRefund)} />
                ) : null}
                {policy.data?.message ? (
                  <Text style={styles.body}>{policy.data.message}</Text>
                ) : null}
              </View>
            )
          ) : (
            <InfoBanner>You have not been charged. Cancelling closes the request.</InfoBanner>
          )}
        </>
      )}
    </Screen>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.body}>{k}</Text>
      <Text style={styles.value}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.tile,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  body: { ...typography.body, color: colors.text },
  value: { ...typography.bodySemibold, color: colors.text },
});
