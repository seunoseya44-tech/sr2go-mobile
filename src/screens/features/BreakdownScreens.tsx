/**
 * Breakdown and rescue, build sheet rows 2, 4–7 (rows 1, 3 and 8 are the
 * button on the active trip and the two pushes). Every message, refusal and
 * money line is shown exactly as the server sends it.
 */
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';

import { breakdownApi, rescueStarted } from '../../api/breakdown';
import { toApiError } from '../../api/errors';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Card, Chip, InfoBanner } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';
import { naira } from '../../utils/format';
import { lagosDateTime } from '../../utils/time';
import { shared } from '../booking/shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const label = (s: string | null) => (s ? s.replace(/_/g, ' ') : 'waiting');

/** Row 2 · Breakdown status (driver), refreshed every 30 s while open. */
export function BreakdownStatusScreen() {
  const { params } = useRoute<RouteProp<AppStackParamList, 'BreakdownStatus'>>();
  const q = useQuery({
    queryKey: ['breakdown', params.breakdownId],
    queryFn: () => breakdownApi.get(params.breakdownId),
    refetchInterval: 30_000,
  });
  const b = q.data;
  return (
    <Screen testID="breakdown-status" topBar={{ title: 'Breakdown' }}>
      {params.message ? <InfoBanner tone="blue">{params.message}</InfoBanner> : null}
      {q.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {q.isError ? <Banner tone="error" message={toApiError(q.error).message} /> : null}
      {b ? (
        <>
          <View style={styles.row}>
            <Ionicons name="warning-outline" size={24} color={colors.navy} />
            <View style={styles.flex}>
              <Text style={styles.title}>{label(b.status)}</Text>
              {b.address ? <Text style={shared.subtitle}>{b.address}</Text> : null}
            </View>
          </View>
          <Text style={shared.overline}>Your passengers</Text>
          {b.requests.length === 0 ? (
            <Text style={shared.subtitle}>SR2Go is finding rescue rides for your passengers.</Text>
          ) : null}
          {b.requests.map((r) => (
            <Card key={r.id}>
              <View style={styles.row}>
                <Text style={[styles.title, styles.flex]}>{r.passengerName ?? 'Passenger'}</Text>
                <Chip label={label(r.status)} tone="grey" />
              </View>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

/** Row 3 · From the push: find this passenger's rescue request, then open row 4. */
export function BreakdownOpenScreen() {
  const { params } = useRoute<RouteProp<AppStackParamList, 'BreakdownOpen'>>();
  const navigation = useNavigation<Nav>();
  const q = useQuery({
    queryKey: ['breakdown', params.breakdownId],
    queryFn: async () => {
      const b = await breakdownApi.get(params.breakdownId);
      const mine = b.requests[0];
      if (mine) navigation.replace('Rescue', { rescueId: mine.id });
      return b;
    },
    retry: false,
  });
  return (
    <Screen testID="breakdown-open" topBar={{ title: 'Your driver has broken down' }}>
      {q.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {q.isError ? <Banner tone="error" message={toApiError(q.error).message} /> : null}
      {q.data && q.data.requests.length === 0 ? (
        <Text style={shared.subtitle}>
          SR2Go is finding rescue rides for you. We will notify you when they are ready.
        </Text>
      ) : null}
    </Screen>
  );
}

/** Rows 4–7 · Rescue screen (passenger). */
export function RescueScreen() {
  const { params } = useRoute<RouteProp<AppStackParamList, 'Rescue'>>();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const q = useQuery({
    queryKey: ['rescue', params.rescueId],
    queryFn: () => breakdownApi.rescue(params.rescueId),
    refetchInterval: 30_000,
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['rescue', params.rescueId] });
  const onError = (e: unknown) => {
    const err = toApiError(e);
    setError(err.message);
    if (err.status === 409) refresh(); // seats just taken: back to the fresh list
  };
  const book = useMutation({
    mutationFn: (rideId: string) => breakdownApi.book(params.rescueId, rideId),
    onMutate: () => setError(null),
    onSuccess: async (a) => {
      setNote([a.message, a.note].filter(Boolean).join(' ') || 'Rescue ride booked.');
      if (a.topUpPaymentUrl)
        await WebBrowser.openBrowserAsync(a.topUpPaymentUrl, { showTitle: true });
      refresh();
    },
    onError,
  });
  const abandon = useMutation({
    mutationFn: () => breakdownApi.abandon(params.rescueId),
    onMutate: () => setError(null),
    onSuccess: (a) => {
      setNote([a.message, a.note].filter(Boolean).join(' ') || 'Rescue closed.');
      setClosed(true);
    },
    onError,
  });
  const complete = useMutation({
    mutationFn: () => breakdownApi.complete(params.rescueId),
    onMutate: () => setError(null),
    onSuccess: (a) => {
      setNote(['Rescue completed.', a.message, a.note].filter(Boolean).join(' '));
      setClosed(true);
    },
    onError,
  });

  const r = q.data;
  const booked =
    !!r?.bookedRideId || (!!r?.status && /booked|started|in_progress|completed/i.test(r.status));
  const started = rescueStarted(r?.status ?? null);

  return (
    <Screen
      testID="rescue"
      topBar={{ title: 'Rescue ride' }}
      footer={
        closed ? (
          <Button
            title="Back to my trips"
            onPress={() => navigation.navigate('Main', { screen: 'Trips' })}
          />
        ) : r ? (
          <>
            {booked ? (
              <Button
                title="I have arrived"
                onPress={() => complete.mutate()}
                loading={complete.isPending}
              />
            ) : null}
            {!started ? (
              <Button
                title="I'll make my own way"
                variant="secondary"
                onPress={() => abandon.mutate()}
                loading={abandon.isPending}
              />
            ) : null}
          </>
        ) : undefined
      }
    >
      {note ? <Banner tone="success" message={note} /> : null}
      {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      {q.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {q.isError ? <Banner tone="error" message={toApiError(q.error).message} /> : null}
      {r && !closed ? (
        <>
          <Card tone="tile">
            <View style={styles.row}>
              <Ionicons name="warning-outline" size={22} color={colors.navy} />
              <View style={styles.flex}>
                <Text style={styles.title}>
                  Stranded at {r.strandedAt ?? 'the breakdown point'}
                </Text>
                {r.destination ? (
                  <Text style={shared.subtitle}>Going to {r.destination}</Text>
                ) : null}
              </View>
            </View>
            {r.note ? <Text style={styles.body}>{r.note}</Text> : null}
          </Card>
          {r.status ? <Chip label={label(r.status)} tone="grey" /> : null}
          {!booked ? (
            <>
              <Text style={shared.overline}>Choose a rescue ride</Text>
              {r.candidates.length === 0 ? (
                <Text style={shared.subtitle}>
                  No rescue rides yet. This list refreshes every 30 seconds.
                </Text>
              ) : null}
              {r.candidates.map((c) => (
                <Card key={c.rideId}>
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <Text style={styles.title}>
                        {c.driverName ?? 'Driver'}
                        {c.driverRating != null ? `  ★ ${c.driverRating.toFixed(1)}` : ''}
                      </Text>
                      <Text style={shared.subtitle}>
                        {lagosDateTime(c.departureTime).time ?? ''}
                        {c.seatsLeft != null
                          ? ` · ${c.seatsLeft} seat${c.seatsLeft === 1 ? '' : 's'} left`
                          : ''}
                        {c.pricePerSeat ? ` · ${naira(c.pricePerSeat)} a seat` : ''}
                      </Text>
                    </View>
                  </View>
                  {c.topUp ? (
                    <Text style={styles.money}>Pay {naira(c.topUp)} extra</Text>
                  ) : c.credit ? (
                    <Text style={styles.money}>{naira(c.credit)} back to you</Text>
                  ) : null}
                  <Button
                    title="Choose this ride"
                    onPress={() => book.mutate(c.rideId)}
                    loading={book.isPending && book.variables === c.rideId}
                    disabled={book.isPending}
                  />
                </Card>
              ))}
            </>
          ) : (
            <Text style={shared.subtitle}>
              Your rescue ride is booked. Tap &quot;I have arrived&quot; once you reach your
              destination.
            </Text>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.bodySemibold, color: colors.text },
  body: { ...typography.body, color: colors.text },
  money: { ...typography.bodySemibold, color: colors.navy },
});
