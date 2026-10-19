import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { driverApi, type RideBooking } from '../../api/driver';
import { toApiError } from '../../api/errors';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Avatar, Chip, LinkText } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { shortDate } from '../../utils/format';
import { shared } from '../booking/shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** Screen 27 · Booking requests: accept / decline, confirmed list, cancel ride, boarding. */
export function RideRequestsScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'RideRequests'>>();
  const queryClient = useQueryClient();
  const ride = useQuery({
    queryKey: ['ride', params.rideId],
    queryFn: () => driverApi.ride(params.rideId),
  });
  const bookings = useQuery({
    queryKey: ['ride-bookings', params.rideId],
    queryFn: () => driverApi.rideBookings(params.rideId),
    refetchInterval: 30_000,
  });
  const [error, setError] = useState<string | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['ride-bookings', params.rideId] });
    void queryClient.invalidateQueries({ queryKey: ['my-rides'] });
  };
  const decide = useMutation({
    mutationFn: (v: { id: string; status: 'accepted' | 'rejected' }) =>
      driverApi.setBookingStatus(v.id, v.status),
    onSuccess: refresh,
    onError: (e) => {
      setError(toApiError(e).message);
      refresh();
    },
  });
  const cancelRide = useMutation({
    mutationFn: () => driverApi.cancelRide(params.rideId),
    onSuccess: () => {
      refresh();
      navigation.goBack();
    },
    onError: (e) => setError(toApiError(e).message),
  });

  const list = bookings.data ?? [];
  const requests = list.filter((b) => b.status === 'pending');
  const confirmed = list.filter((b) => b.status === 'accepted' || b.status === 'completed');
  const r = ride.data;

  const confirmCancel = () =>
    Alert.alert('Cancel this ride?', 'Every paid passenger is refunded in full automatically.', [
      { text: 'Keep ride', style: 'cancel' },
      { text: 'Cancel ride', style: 'destructive', onPress: () => cancelRide.mutate() },
    ]);

  return (
    <Screen
      testID="ride-requests"
      topBar={{ leading: 'back' }}
      footer={
        <View style={styles.twoUp}>
          <Button
            title="Cancel ride"
            variant="secondary"
            onPress={confirmCancel}
            loading={cancelRide.isPending}
            style={styles.flex}
          />
          <Button
            title="Boarding"
            icon="qr-code-outline"
            onPress={() => navigation.navigate('DriverBoarding', { rideId: params.rideId })}
            style={styles.flex}
          />
        </View>
      }
    >
      {r ? (
        <View>
          <Text style={styles.h}>
            {shortDate(r.departureDate)} · {r.departureTime}
          </Text>
          <Text style={shared.subtitle}>
            {r.originCity} → {r.destinationCity}
          </Text>
        </View>
      ) : null}
      {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      <View style={styles.twoUp}>
        <Button
          title="Trip chat"
          variant="secondary"
          icon="chatbubble-ellipses-outline"
          onPress={() =>
            navigation.navigate('TripChat', { rideId: params.rideId, title: 'Trip chat' })
          }
          style={styles.flex}
        />
        <Button
          title="Hand over"
          variant="secondary"
          icon="swap-horizontal-outline"
          onPress={() => navigation.navigate('HandoverRide', { rideId: params.rideId })}
          style={styles.flex}
        />
      </View>
      <LinkText onPress={() => navigation.navigate('HandoversInbox')}>My handovers</LinkText>
      {bookings.isPending ? (
        <ActivityIndicator color={colors.brand} />
      ) : bookings.isError ? (
        <Banner tone="error" message={toApiError(bookings.error).message} />
      ) : (
        <>
          <Text style={shared.overline}>Requests ({requests.length})</Text>
          {requests.length === 0 ? <Text style={shared.subtitle}>No requests waiting.</Text> : null}
          {requests.map((b) => (
            <PassengerCard key={b.id} b={b}>
              <View style={styles.twoUp}>
                <Button
                  title="Decline"
                  variant="secondary"
                  onPress={() => decide.mutate({ id: b.id, status: 'rejected' })}
                  style={styles.flex}
                />
                <Button
                  title="Accept"
                  onPress={() => decide.mutate({ id: b.id, status: 'accepted' })}
                  style={styles.flex}
                />
              </View>
            </PassengerCard>
          ))}
          <Text style={shared.overline}>Confirmed ({confirmed.length})</Text>
          {confirmed.length === 0 ? (
            <Text style={shared.subtitle}>No confirmed passengers yet.</Text>
          ) : null}
          {confirmed.map((b) => (
            <PassengerCard key={b.id} b={b}>
              <View style={styles.cardFoot}>
                <Chip
                  label={
                    b.boarded
                      ? 'Boarded'
                      : b.paid
                        ? 'Confirmed · Paid'
                        : 'Accepted, waiting for payment'
                  }
                  tone={b.paid ? 'blue' : 'grey'}
                />
                {b.paid && b.passengerPhone ? (
                  <Button
                    title="Call"
                    icon="call-outline"
                    onPress={() => Linking.openURL(`tel:${b.passengerPhone}`)}
                  />
                ) : null}
              </View>
            </PassengerCard>
          ))}
        </>
      )}
    </Screen>
  );
}

function PassengerCard({ b, children }: { b: RideBooking; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Avatar name={b.passengerName} size={40} verified={b.passengerVerified} />
        <View style={styles.flex}>
          <Text style={styles.semi}>{b.passengerName ?? 'Passenger'}</Text>
          <Text style={shared.subtitle}>
            {b.passengerRating != null ? `★ ${b.passengerRating.toFixed(1)} · ` : ''}
            {b.seats} seat{b.seats === 1 ? '' : 's'}
            {b.children ? ` · ${b.children} child${b.children === 1 ? '' : 'ren'}` : ''}
          </Text>
        </View>
        {b.connecting ? <Chip label="Connecting passenger" tone="blue" /> : null}
        {b.frontSeatPreferred ? <Chip label="Front seat preferred" tone="blue" /> : null}
      </View>
      <Text style={styles.note}>“{b.note ?? 'No note'}”</Text>
      <Text style={shared.subtitle}>
        {b.luggageKg != null
          ? `Luggage: ${b.luggageKg} kg${b.luggageDescription ? ` · ${b.luggageDescription}` : ''}`
          : 'No luggage'}
      </Text>
      {b.message ? (
        <View style={styles.tile}>
          <Text style={shared.subtitle}>{b.message}</Text>
        </View>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  h: { ...typography.heading, color: colors.text },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  semi: { ...typography.bodySemibold, color: colors.text },
  note: { ...typography.body, color: colors.textMuted, fontStyle: 'italic' },
  twoUp: { flexDirection: 'row', gap: spacing.sm },
  cardFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tile: { backgroundColor: colors.tile, borderRadius: radius.md, padding: spacing.sm },
});
