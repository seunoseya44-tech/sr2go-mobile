import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';

import { bookingsApi, paymentsApi, type PaymentInitiation } from '../../api/bookings';
import { toApiError } from '../../api/errors';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { InfoBanner, RoadLine } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { naira } from '../../utils/format';
import { bookingView, mmss, shared, tripLine, useCountdown } from './shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * Screen 13 · Payment. The amounts (total, credits_applied, you_pay) come
 * only from POST /api/payments/initiate; the app never calculates them.
 * Paystack opens in the system browser sheet; verify runs when it closes.
 */
export function PaymentScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'Payment'>>();
  const queryClient = useQueryClient();
  const booking = useQuery({
    queryKey: ['bookings', params.bookingId],
    queryFn: () => bookingsApi.get(params.bookingId),
  });
  const b = booking.data ?? null;

  const [useCredits, setUseCredits] = useState(true);
  const [quote, setQuote] = useState<PaymentInitiation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkAgain, setCheckAgain] = useState(false);

  // First initiate call is a quote: it tells us the credits line and "You pay".
  const initiate = useMutation({
    mutationFn: (credits: boolean) =>
      paymentsApi.initiate(params.bookingId, credits, params.connectionId),
    onSuccess: (q) => setQuote(q),
    onError: (e) => handleInitiateError(e),
  });

  useEffect(() => {
    if (b && bookingView(b) === 'payNow' && !quote && !initiate.isPending) {
      initiate.mutate(useCredits);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b?.id]);

  const left = useCountdown(quote?.payBy ?? b?.payBy ?? null);
  const expired = (b && bookingView(b) === 'payExpired') || left === 0;

  const verify = useMutation({
    mutationFn: (reference: string) => paymentsApi.verify(reference),
    onSuccess: (v) => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigation.replace('PaymentResult', {
        bookingId: params.bookingId,
        status: v.status,
        message: v.message,
        youPaid: v.youPaid,
        reference: v.reference,
      });
    },
    onError: (e) => setError(toApiError(e).message),
  });

  function handleInitiateError(e: unknown) {
    const err = toApiError(e);
    setError(err.message);
    if (err.code === 'already_paid' && err.extra.reference) {
      verify.mutate(err.extra.reference);
    } else if (err.code === 'payment_in_progress') {
      setCheckAgain(true);
    }
  }

  const pay = useMutation({
    mutationFn: async () => {
      const q = await paymentsApi.initiate(params.bookingId, useCredits, params.connectionId);
      setQuote(q);
      if (!q.authorizationUrl) throw new Error('No payment page was returned');
      await WebBrowser.openBrowserAsync(q.authorizationUrl, { showTitle: true });
      return q;
    },
    onSuccess: (q) => {
      if (q.reference) verify.mutate(q.reference);
    },
    onError: (e) => handleInitiateError(e),
  });

  const toggleCredits = (next: boolean) => {
    setUseCredits(next);
    setError(null);
    initiate.mutate(next);
  };

  const youPay = quote?.youPay ?? quote?.total ?? b?.payAmount ?? null;
  const busy = pay.isPending || verify.isPending;
  const goHome = () => navigation.navigate('Main', { screen: 'Home' });

  return (
    <Screen
      testID="payment"
      topBar={{ title: 'Payment' }}
      footer={
        expired ? (
          <Button title="Find another ride" onPress={goHome} />
        ) : checkAgain ? (
          <Button
            title="Check again"
            onPress={() => {
              setCheckAgain(false);
              setError(null);
              initiate.mutate(useCredits);
            }}
          />
        ) : (
          <Button
            title={youPay ? `Pay ${naira(youPay)}` : 'Pay'}
            onPress={() => {
              setError(null);
              pay.mutate();
            }}
            loading={busy}
            loadingTitle={verify.isPending ? 'Confirming your payment…' : 'Opening Paystack…'}
            disabled={!b || !youPay}
            testID="pay-button"
          />
        )
      }
    >
      {b ? <Text style={shared.subtitle}>{tripLine(b)}</Text> : null}
      {error ? <Banner tone="error" message={error} /> : null}

      {!expired && b ? (
        <InfoBanner>
          {b.driverName ?? 'The driver'} accepted your request. Pay now to confirm your seat.
        </InfoBanner>
      ) : null}

      {expired ? (
        <View style={styles.expiredTile}>
          <Text style={styles.expiredText}>
            The time to pay has passed. Your seat was released.
          </Text>
        </View>
      ) : left != null ? (
        <View style={styles.countdown}>
          <Ionicons name="time-outline" size={22} color={colors.navy} />
          <Text style={styles.countdownText}>Pay within {mmss(left)}</Text>
        </View>
      ) : null}

      <View style={[styles.priceCard, expired && styles.greyed]}>
        <View style={styles.priceRow}>
          {b?.usualFare ? <Text style={styles.usual}>Usual fare {naira(b.usualFare)}</Text> : null}
          <Text style={styles.price}>{naira(quote?.total ?? b?.payAmount ?? '')}</Text>
        </View>

        {quote?.creditsAvailable || quote?.creditsApplied ? (
          <>
            <View style={styles.toggleRow}>
              <View style={styles.flex}>
                <Text style={styles.body}>Use ride credits</Text>
                {quote.creditsAvailable ? (
                  <Text style={styles.helper}>{naira(quote.creditsAvailable)} available</Text>
                ) : null}
              </View>
              <Switch
                value={useCredits}
                onValueChange={toggleCredits}
                trackColor={{ true: colors.brand, false: colors.border }}
                thumbColor={colors.surface}
                disabled={initiate.isPending || expired}
              />
            </View>
            {useCredits && quote.creditsApplied ? (
              <View style={styles.kv}>
                <Text style={styles.body}>Ride credits</Text>
                <Text style={styles.body}>−{naira(quote.creditsApplied)}</Text>
              </View>
            ) : null}
          </>
        ) : null}

        <RoadLine />
        <View style={styles.kv}>
          <Text style={styles.bodySemi}>You pay</Text>
          <Text style={styles.price}>{youPay ? naira(youPay) : '—'}</Text>
        </View>
      </View>

      <View style={styles.lockRow}>
        <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
        <Text style={styles.helperFlex}>
          We never store your card or bank details. Payments are handled by Paystack. Pay by card,
          bank transfer or USSD.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  countdownText: {
    ...typography.heading,
    color: colors.navy,
    fontVariant: ['tabular-nums'],
  },
  expiredTile: { backgroundColor: colors.tile, borderRadius: radius.lg, padding: spacing.md },
  expiredText: { ...typography.body, color: colors.navy },
  priceCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  greyed: { opacity: 0.5 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
  usual: {
    ...typography.secondary,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  price: { ...typography.price, color: colors.navy },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  body: { ...typography.body, color: colors.text },
  bodySemi: { ...typography.bodySemibold, color: colors.text },
  helper: { ...typography.secondary, color: colors.textMuted },
  helperFlex: { ...typography.secondary, color: colors.textMuted, flex: 1 },
  lockRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
});
