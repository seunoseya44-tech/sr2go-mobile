import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';

import { driverApi } from '../../api/driver';
import { disputeRoomsApi } from '../../api/social';
import { readEmergencyContact } from '../profile/ProfileScreens';
import { toApiError } from '../../api/errors';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Avatar, Chip, InfoBanner } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { shared } from '../booking/shared';
import { breakdownApi } from '../../api/breakdown';
import { appConfig } from '../../config/appConfig';
import {
  liveTripState,
  sendPosition,
  startLiveTrip,
  stopLiveTrip,
  type LiveTripStart,
} from '../../trip/liveTrip';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * Screen 33 (driver view) + 35 · Active trip. Shares the car's position in the
 * background every few seconds until the ride is completed (server release
 * 128); the driver can share his own tracking link. SOS is one tap.
 */
export function ActiveTripScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'ActiveTrip'>>();
  const queryClient = useQueryClient();
  const ride = useQuery({
    queryKey: ['ride', params.rideId],
    queryFn: () => driverApi.ride(params.rideId),
  });
  const bookings = useQuery({
    queryKey: ['ride-bookings', params.rideId],
    queryFn: () => driverApi.rideBookings(params.rideId),
  });
  const rooms = useQuery({
    queryKey: ['dispute-rooms'],
    queryFn: disputeRoomsApi.rooms,
    retry: false,
  });
  const paid = (bookings.data ?? []).filter((b) => b.paid);

  // Server release 128 (6 Nov): from Start ride until the trip ends the phone sends the car's position in the
  // background every few seconds ("SR2Go is sharing your trip" notification), also with the phone locked.
  const [mode, setMode] = useState<LiveTripStart | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let alive = true;
    startLiveTrip(params.rideId)
      .then((m) => alive && setMode(m))
      .catch(() => alive && setMode('screen_only'));
    return () => {
      alive = false;
    };
  }, [params.rideId]);
  // Location not allowed "all the time": this screen sends while it is open.
  useEffect(() => {
    if (mode !== 'screen_only') return;
    let stopped = false;
    const send = async () => {
      if (stopped) return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!(await sendPosition(params.rideId, pos))) stopped = true;
      } catch {
        // a missed position is sent at the next tick
      }
    };
    void send();
    const t = setInterval(() => void send(), appConfig().livePositionSeconds * 1000);
    return () => clearInterval(t);
  }, [mode, params.rideId]);
  useEffect(() => {
    const tick = async () => {
      setNow(Date.now());
      setLastSentAt((await liveTripState())?.lastSentAt ?? null);
    };
    void tick();
    const t = setInterval(() => void tick(), 15_000);
    return () => clearInterval(t);
  }, []);
  const minsAgo = lastSentAt != null ? Math.max(0, Math.round((now - lastSentAt) / 60_000)) : null;
  const gpsNote =
    mode === 'denied'
      ? 'Location permission is off, so your position is not shared.'
      : mode === 'screen_only'
        ? 'Allow location "All the time" so families can still follow the car when your phone is locked.'
        : null;
  const share = useMutation({
    mutationFn: async () => {
      const l = await driverApi.trackingLink(params.rideId);
      await Share.share({ message: l.shareMessage ?? l.trackingUrl ?? '' });
    },
  });

  const complete = useMutation({
    mutationFn: () => driverApi.completeRide(params.rideId),
    onSuccess: () => {
      void stopLiveTrip();
      void queryClient.invalidateQueries({ queryKey: ['my-rides'] });
      navigation.replace('EvidenceCamera', { rideId: params.rideId, event: 'journey_complete' });
    },
  });
  const sos = useMutation({
    mutationFn: async () => {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).catch(() => null);
      const first = paid[0];
      if (!first) throw new Error('No active booking to attach the alert to.');
      const { http, ENDPOINTS } = await import('../../api/client');
      const contact = await readEmergencyContact();
      await http.post(`${ENDPOINTS.bookings}/${first.id}/sos`, {
        latitude: pos?.coords.latitude ?? null,
        longitude: pos?.coords.longitude ?? null,
        message: 'SOS from the driver app',
        emergency_contact_phone: contact?.phone ?? null,
      });
    },
  });

  // Breakdown and rescue, row 1: file a breakdown with the phone's position.
  const breakdown = useMutation({
    mutationFn: async () => {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }).catch(() => null);
      if (!pos) throw new Error('Turn on location so SR2Go can find rescue rides near you.');
      return breakdownApi.file({
        rideId: params.rideId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    },
    onSuccess: (b) =>
      navigation.navigate('BreakdownStatus', {
        breakdownId: b.id,
        message: `SR2Go is finding rescue rides for your passengers${
          b.strandedCount != null ? ` (${b.strandedCount})` : ''
        }.`,
      }),
  });
  const askBreakdown = () =>
    Alert.alert(
      'Report a breakdown?',
      'SR2Go will find rescue rides for your passengers. Your position is sent with the report.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report breakdown', style: 'destructive', onPress: () => breakdown.mutate() },
      ],
    );

  const askComplete = () =>
    Alert.alert(
      'Complete this ride?',
      'Only complete when all passengers have reached their destination. Payout arrives 24–48 hours after trip completion.',
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Yes, complete ride', onPress: () => complete.mutate() },
      ],
    );

  const r = ride.data;
  const rawBreakdown = r?.raw?.breakdown_id;
  const existingBreakdown =
    rawBreakdown != null && rawBreakdown !== '' ? String(rawBreakdown) : null;

  if (sos.isSuccess) {
    return (
      <Screen
        testID="sos-fired"
        topBar={null}
        background={colors.danger}
        statusBar="light"
        footer={
          <>
            <Button
              title="Call 112"
              icon="call-outline"
              variant="light"
              onPress={() => Linking.openURL('tel:112')}
            />
            <Button
              title="Call SR2Go support"
              variant="outlineLight"
              onPress={() => Linking.openURL(`tel:${appConfig().supportPhone}`)}
            />
            <Button title="Back to the trip" variant="outlineLight" onPress={() => sos.reset()} />
          </>
        }
      >
        <View style={shared.centered}>
          <Ionicons name="alert-circle" size={56} color={colors.textOnBrand} />
          <Text style={[shared.heading, styles.onRed]}>Help is on the way</Text>
          <Text style={[shared.body, styles.onRed]}>
            Help is on the way. In an emergency, call 112 (police 199, FRSC 122).
          </Text>
          <Text style={[shared.small, styles.onRed]}>
            If you are in immediate danger, call 112 first.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      testID="active-trip"
      topBar={{
        leading: 'none',
        title: r ? `On the road to ${(r.destinationCity ?? '').split(',')[0]}` : 'On the road',
      }}
      footer={
        <>
          <Button title="Complete ride" onPress={askComplete} loading={complete.isPending} />
          {existingBreakdown ? (
            <Button
              title="Breakdown status"
              variant="secondary"
              icon="warning-outline"
              onPress={() =>
                navigation.navigate('BreakdownStatus', { breakdownId: existingBreakdown })
              }
            />
          ) : (
            <Button
              title="Report a breakdown"
              variant="secondary"
              icon="warning-outline"
              onPress={askBreakdown}
              loading={breakdown.isPending}
            />
          )}
        </>
      }
    >
      {breakdown.isError ? (
        <Banner tone="error" message={toApiError(breakdown.error).message} />
      ) : null}
      {complete.isError ? (
        <Banner tone="error" message={toApiError(complete.error).message} />
      ) : null}
      {sos.isError ? <Banner tone="error" message={toApiError(sos.error).message} /> : null}
      <View style={styles.map}>
        <Ionicons name="navigate-outline" size={28} color={colors.navy} />
        <Text style={shared.subtitle}>
          {r?.originCity} → {r?.destinationCity}
        </Text>
      </View>
      <View style={styles.rowBetween}>
        <Chip label="On the road" tone="blue" />
        <Text style={shared.small}>
          {minsAgo != null ? `Updated ${minsAgo} min ago` : 'Sharing your position…'}
        </Text>
      </View>
      {gpsNote ? <InfoBanner tone="amber">{gpsNote}</InfoBanner> : null}
      {mode === 'screen_only' ? (
        <Button
          title="Open location settings"
          variant="secondary"
          onPress={() => void Linking.openSettings()}
        />
      ) : null}
      {share.isError ? <Banner tone="error" message={toApiError(share.error).message} /> : null}
      <Button
        title="Share my trip"
        variant="secondary"
        icon="share-social-outline"
        onPress={() => share.mutate()}
        loading={share.isPending}
      />
      <Text style={shared.overline}>Passengers</Text>
      {paid.map((b) => (
        <View key={b.id} style={styles.row}>
          <Avatar name={b.passengerName} size={40} verified={b.passengerVerified} />
          <Text style={[styles.semi, styles.flex]}>
            {b.passengerName ?? 'Passenger'}
            {b.seats > 1 ? ` (${b.seats})` : ''}
          </Text>
          {b.passengerPhone ? (
            <Pressable
              onPress={() => Linking.openURL(`tel:${b.passengerPhone}`)}
              style={styles.callBtn}
              accessibilityRole="button"
              accessibilityLabel={`Call ${b.passengerName ?? 'passenger'}`}
            >
              <Ionicons name="call-outline" size={20} color={colors.textOnBrand} />
            </Pressable>
          ) : null}
          <Chip label={b.boarded ? 'Boarded' : 'Not boarded'} tone={b.boarded ? 'blue' : 'grey'} />
        </View>
      ))}
      <View style={styles.sosWrap}>
        <Pressable
          onPress={() => sos.mutate()}
          style={styles.sos}
          accessibilityRole="button"
          accessibilityLabel="SOS"
          disabled={sos.isPending}
        >
          <Text style={styles.sosText}>SOS</Text>
        </Pressable>
        <Text style={shared.small}>
          One tap alerts SR2Go, your passengers and your emergency contact
        </Text>
      </View>
      {rooms.data && rooms.data.length > 0 ? (
        <Button
          title="Disputes"
          variant="secondary"
          icon="chatbubbles-outline"
          onPress={() => navigation.navigate('MyReports')}
        />
      ) : null}
      <Text style={shared.small}>
        Your position is shared every few seconds until you complete the ride, also with the phone
        locked.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  map: {
    height: 140,
    borderRadius: radius.lg,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52 },
  semi: { ...typography.bodySemibold, color: colors.text },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosWrap: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  sos: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosText: { ...typography.heading, color: colors.textOnBrand },
  onRed: { color: colors.textOnBrand },
});
