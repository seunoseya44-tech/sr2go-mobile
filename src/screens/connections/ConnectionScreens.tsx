import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { toApiError } from '../../api/errors';
import { connectionsApi, type Connection, type ConnectionOption } from '../../api/social';
import type { Ride } from '../../api/types';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import {
  Avatar,
  Checkbox,
  Chip,
  InfoBanner,
  LinkText,
  PriceBlock,
  RoadLine,
  Stepper,
} from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { shortDate, vehicleLabel } from '../../utils/format';
import { openDirections } from '../RideDetailsScreen';
import { mmss, ResultIcon, shared, useCountdown } from '../booking/shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** The latest connecting-trip search results, kept for the details screens. */
let lastOptions: ConnectionOption[] = [];
export function setConnectionOptions(o: ConnectionOption[]) {
  lastOptions = o;
}
export function getConnectionOption(i: number): ConnectionOption | null {
  return lastOptions[i] ?? null;
}

/** C1 · The "With one stop" card on search results. */
export function ConnectionCard({
  option: o,
  onPress,
}: {
  option: ConnectionOption;
  onPress: () => void;
}) {
  const leg = (r: Ride | null, label: string) => (
    <View style={styles.leg}>
      <Text style={styles.legTime}>{r?.departureTime ?? '—'}</Text>
      <View style={styles.flex}>
        <Text style={shared.subtitle}>{label}</Text>
        <View style={styles.row}>
          <Avatar name={r?.driverName ?? null} size={24} verified={r?.driverVerified} />
          <Text style={styles.body}>{r?.driverName ?? 'Driver'}</Text>
          {r?.driverRating != null ? (
            <Text style={shared.subtitle}>★ {r.driverRating.toFixed(1)}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.tile }]}
      accessibilityRole="button"
    >
      <View style={styles.chips}>
        <Chip
          label={`1 stop · change at ${o.hub ?? o.changeover.name ?? 'the hub'}`}
          tone="blue"
          icon="git-branch-outline"
        />
        {o.connection === 'longer_wait' ? (
          <Chip label={`Longer wait at ${o.hub ?? 'the hub'}`} tone="grey" />
        ) : null}
      </View>
      {leg(o.ride1, `${o.ride1?.originCity ?? ''} → ${o.ride1?.destinationCity ?? o.hub ?? ''}`)}
      <View style={styles.connector}>
        <RoadLine vertical length={20} />
        <Ionicons name="location-outline" size={14} color={colors.navy} />
      </View>
      {leg(o.ride2, `${o.ride2?.originCity ?? o.hub ?? ''} → ${o.ride2?.destinationCity ?? ''}`)}
      <PriceBlock
        payAmount={o.payAmount}
        usualFare={o.usualFare}
        savingsPct={o.savingsPct}
        align="right"
      />
    </Pressable>
  );
}

/** C2 · Connecting trip details. */
export function ConnectionDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'ConnectionDetails'>>();
  const o = getConnectionOption(params.index);
  if (!o) {
    return (
      <Screen testID="connection-details" topBar={{ title: 'Trip with one stop' }}>
        <Banner tone="error" message="This option has expired. Please search again." />
      </Screen>
    );
  }
  const rideCard = (r: Ride | null, label: string) =>
    r ? (
      <View style={styles.node}>
        <Text style={shared.overline}>{label}</Text>
        <View style={styles.card}>
          <Text style={styles.legTime}>Departs {r.departureTime}</Text>
          <View style={styles.row}>
            <Avatar name={r.driverName} size={40} verified={r.driverVerified} />
            <View style={styles.flex}>
              <Text style={styles.semi}>{r.driverName ?? 'Driver'}</Text>
              <Text style={shared.subtitle}>
                {r.driverRating != null ? `★ ${r.driverRating.toFixed(1)}` : ''}
                {r.driverTripsCompleted != null ? ` · ${r.driverTripsCompleted} trips` : ''}
              </Text>
            </View>
            {r.driverId ? (
              <LinkText
                onPress={() =>
                  navigation.navigate('DriverProfile', {
                    driverId: r.driverId!,
                    name: r.driverName,
                  })
                }
              >
                View profile
              </LinkText>
            ) : null}
          </View>
          <Text style={shared.subtitle}>{vehicleLabel(r.vehicleType)}</Text>
          <View style={styles.chips}>
            <Chip
              label={r.autoApprove ? 'Instant booking' : 'Driver approves requests'}
              tone="blue"
            />
            {r.isAc ? <Chip label="AC" tone="blue" /> : null}
          </View>
          {r.meetingPointName ? (
            <View style={styles.row}>
              <Ionicons name="location-outline" size={18} color={colors.brand} />
              <View style={styles.flex}>
                <Text style={styles.semi}>{r.meetingPointName}</Text>
                {r.meetingPointAddress ? (
                  <Text style={shared.subtitle}>{r.meetingPointAddress}</Text>
                ) : null}
              </View>
              {r.meetingPointLat != null && r.meetingPointLng != null ? (
                <LinkText
                  onPress={() =>
                    void openDirections(r.meetingPointLat!, r.meetingPointLng!, r.meetingPointName!)
                  }
                >
                  Directions
                </LinkText>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    ) : null;

  return (
    <Screen
      testID="connection-details"
      topBar={{ title: 'Trip with one stop' }}
      footer={
        <View style={styles.bottomBar}>
          <PriceBlock
            payAmount={o.payAmount}
            usualFare={o.usualFare}
            savingsPct={o.savingsPct}
            align="left"
          />
          <Button
            title="Request both rides"
            onPress={() => navigation.navigate('ConnectionBook', { index: params.index })}
            style={styles.flex}
          />
        </View>
      }
    >
      <Text style={shared.subtitle}>
        {o.ride1?.originCity} → {o.ride2?.destinationCity} · {shortDate(o.ride1?.departureDate)}
      </Text>
      {rideCard(
        o.ride1,
        `Ride 1 · ${o.ride1?.originCity ?? ''} → ${o.ride1?.destinationCity ?? o.hub ?? ''}`,
      )}
      <View style={styles.node}>
        <Text style={shared.overline}>Change at {o.hub ?? o.changeover.name ?? 'the hub'}</Text>
        <View style={styles.changeover}>
          <Text style={styles.semi}>{o.changeover.name ?? '—'}</Text>
          {o.changeover.address ? (
            <Text style={shared.subtitle}>{o.changeover.address}</Text>
          ) : null}
          {o.changeover.lat != null && o.changeover.lng != null ? (
            <LinkText
              onPress={() =>
                void openDirections(
                  o.changeover.lat!,
                  o.changeover.lng!,
                  o.changeover.name ?? 'Changeover',
                )
              }
            >
              Directions
            </LinkText>
          ) : null}
          <View style={styles.row}>
            <Ionicons name="time-outline" size={18} color={colors.navy} />
            <Text style={styles.body}>
              Your next ride leaves at {o.ride2?.departureTime ?? '—'}
            </Text>
          </View>
        </View>
      </View>
      {rideCard(
        o.ride2,
        `Ride 2 · ${o.ride2?.originCity ?? o.hub ?? ''} → ${o.ride2?.destinationCity ?? ''}`,
      )}
      <Text style={shared.subtitle}>
        If your first ride arrives after the second ride leaves, the second ride&apos;s fare is
        refunded in full.
      </Text>
    </Screen>
  );
}

/** Book both rides: same form as Book your seat, one request. */
export function ConnectionBookScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'ConnectionBook'>>();
  const queryClient = useQueryClient();
  const o = getConnectionOption(params.index);
  const [children, setChildren] = useState(0);
  const [frontSeat, setFrontSeat] = useState(false);
  const [note, setNote] = useState('');
  const [address, setAddress] = useState('');
  const [luggageKg, setLuggageKg] = useState('');
  const [luggageDesc, setLuggageDesc] = useState('');
  const create = useMutation({
    mutationFn: () =>
      connectionsApi.create({
        rideIds: o!.rideIds,
        children,
        frontSeatPreferred: frontSeat,
        pickupNote: note.trim(),
        pickupAddress: address.trim(),
        luggageKg: luggageKg.trim() ? Number(luggageKg) : null,
        luggageDescription: luggageDesc.trim(),
      }),
    onSuccess: (c) => {
      void queryClient.invalidateQueries({ queryKey: ['connections'] });
      navigation.replace('ConnectionStatus', { connectionId: c.id });
    },
  });
  if (!o) return null;
  const seatsLeft = Math.min(o.ride1?.seatsLeft ?? 7, o.ride2?.seatsLeft ?? 7);
  return (
    <Screen
      testID="connection-book"
      topBar={{ title: 'Request both rides' }}
      footer={
        <Button
          title="Request both rides"
          onPress={() => create.mutate()}
          loading={create.isPending}
        />
      }
    >
      <Text style={shared.subtitle}>
        {o.ride1?.originCity} → {o.ride2?.destinationCity} · {shortDate(o.ride1?.departureDate)} · 1
        stop
      </Text>
      {create.isError ? <Banner tone="error" message={toApiError(create.error).message} /> : null}
      <InfoBanner>
        You won&apos;t pay until both drivers accept. Nothing is charged if either can&apos;t take
        you.
      </InfoBanner>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.body}>Children travelling with you (under 18)</Text>
          <Text style={shared.subtitle}>{seatsLeft} seats left</Text>
        </View>
        <Stepper value={children} min={0} max={Math.max(0, seatsLeft - 1)} onChange={setChildren} />
      </View>
      <Checkbox checked={frontSeat} onChange={setFrontSeat}>
        Front seat preferred (the driver will try, not guaranteed)
      </Checkbox>
      <TextField label="Note for the drivers" value={note} onChangeText={setNote} multiline />
      <TextField label="Pickup address (optional)" value={address} onChangeText={setAddress} />
      <View style={styles.twoUp}>
        <View style={styles.flex}>
          <TextField
            label="Luggage (kg)"
            keyboardType="numeric"
            value={luggageKg}
            onChangeText={setLuggageKg}
          />
        </View>
        <View style={styles.flex}>
          <TextField label="Description" value={luggageDesc} onChangeText={setLuggageDesc} />
        </View>
      </View>
    </Screen>
  );
}

/** C3 / C4 entry / C5 / C7 · One screen that follows the connection's status. */
export function ConnectionStatusScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'ConnectionStatus'>>();
  const query = useQuery({
    queryKey: ['connection', params.connectionId],
    queryFn: () => connectionsApi.get(params.connectionId),
    refetchInterval: 20_000,
  });
  const c = query.data ?? null;
  const left = useCountdown(c?.status === 'awaiting_payment' ? c.payBy : null);
  const goHome = () => navigation.navigate('Main', { screen: 'Home' });

  useEffect(() => {
    if (c?.status === 'awaiting_payment' && c.legs[0]?.bookingId) {
      navigation.replace('Payment', { bookingId: c.legs[0].bookingId, connectionId: c.id });
    }
  }, [c, navigation]);

  if (!c) {
    return (
      <Screen testID="connection-status" topBar={{ leading: 'close', onLeadingPress: goHome }}>
        {query.isError ? (
          <Banner tone="error" message={toApiError(query.error).message} />
        ) : (
          <ActivityIndicator color={colors.brand} />
        )}
      </Screen>
    );
  }
  const route = `${c.legs[0]?.ride?.originCity ?? ''} → ${c.legs[1]?.ride?.destinationCity ?? c.legs[0]?.ride?.destinationCity ?? ''}`;

  if (c.status === 'missed_connection') {
    return (
      <Screen
        testID="connection-status"
        topBar={{ leading: 'close', onLeadingPress: goHome }}
        footer={<Button title={`Find another ride from ${c.hub ?? 'here'}`} onPress={goHome} />}
      >
        <View style={shared.centered}>
          <ResultIcon icon="time-outline" />
          <Text style={shared.heading}>You missed your connection</Text>
          <Text style={shared.body}>
            {c.message ??
              'Your first ride arrived after the second ride left. The ride 2 fare has been refunded.'}
          </Text>
          {c.refund?.cash ? (
            <Text style={shared.subtitle}>Refund to your card: {c.refund.cash}</Text>
          ) : null}
          {c.refund?.credit ? (
            <Text style={shared.subtitle}>Refund to your wallet: {c.refund.credit}</Text>
          ) : null}
        </View>
      </Screen>
    );
  }

  if (c.status === 'confirmed' || c.status === 'completed') {
    return (
      <Screen
        testID="connection-status"
        topBar={{
          leading: 'close',
          onLeadingPress: () => navigation.navigate('Main', { screen: 'Trips' }),
        }}
      >
        <View style={styles.header}>
          <Ionicons name="checkmark-circle" size={32} color={colors.textOnBrand} />
          <Text style={styles.headerTitle}>You&apos;re booked!</Text>
          <Text style={styles.headerLine}>{route} · 1 stop</Text>
        </View>
        {c.legs.map((leg, i) => (
          <View key={leg.bookingId ?? i} style={styles.node}>
            <Text style={shared.overline}>
              Ride {i + 1} · {leg.ride?.originCity ?? ''} → {leg.ride?.destinationCity ?? ''} ·{' '}
              {leg.ride?.departureTime ?? ''}
            </Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Avatar
                  name={leg.ride?.driverName ?? null}
                  size={40}
                  verified={leg.ride?.driverVerified}
                />
                <Text style={styles.semi}>{leg.ride?.driverName ?? 'Driver'}</Text>
              </View>
              {leg.ride?.meetingPointName ? (
                <Text style={shared.subtitle}>{leg.ride.meetingPointName}</Text>
              ) : null}
              {leg.bookingId ? (
                <Button
                  title={`Boarding pass for ride ${i + 1}`}
                  variant="secondary"
                  onPress={() => navigation.navigate('BoardingPass', { bookingId: leg.bookingId! })}
                />
              ) : null}
            </View>
            {i === 0 ? (
              <View style={styles.changeover}>
                <Text style={shared.overline}>Change at {c.hub ?? c.changeover.name ?? ''}</Text>
                <Text style={styles.semi}>{c.changeover.name ?? '—'}</Text>
                {c.changeover.lat != null && c.changeover.lng != null ? (
                  <LinkText
                    onPress={() =>
                      void openDirections(
                        c.changeover.lat!,
                        c.changeover.lng!,
                        c.changeover.name ?? 'Changeover',
                      )
                    }
                  >
                    Get directions
                  </LinkText>
                ) : null}
                <Text style={styles.body}>
                  Your next ride leaves at {c.legs[1]?.ride?.departureTime ?? '—'}
                </Text>
              </View>
            ) : null}
          </View>
        ))}
        <InfoBanner tone="amber">
          Safety tip: At the car, scan or type the code on your driver&apos;s phone, then check
          their photo. Your driver checks yours too.
        </InfoBanner>
      </Screen>
    );
  }

  const closed = c.status === 'closed';
  return (
    <Screen
      testID="connection-status"
      topBar={{ leading: 'close', onLeadingPress: goHome }}
      footer={
        closed ? (
          <Button title="Find another ride" onPress={goHome} />
        ) : (
          <Button title="Back to home" onPress={goHome} />
        )
      }
    >
      <View style={shared.centered}>
        <Text style={shared.overline}>{closed ? 'Request closed' : 'Request sent'}</Text>
        <Text style={shared.heading}>
          {closed ? 'Request closed. You were not charged.' : 'Waiting for 2 drivers'}
        </Text>
        {!closed ? (
          <Text style={shared.body}>
            You&apos;ll pay once both drivers accept. Nothing is charged if either can&apos;t take
            you.
          </Text>
        ) : null}
        {left != null ? <Text style={styles.body}>Pay within {mmss(left)}</Text> : null}
      </View>
      {c.legs.map((leg, i) => (
        <View key={leg.bookingId ?? i} style={styles.row}>
          <Avatar name={leg.ride?.driverName ?? null} size={40} />
          <View style={styles.flex}>
            <Text style={styles.semi}>{leg.ride?.driverName ?? `Driver ${i + 1}`}</Text>
            <Text style={shared.subtitle}>
              {leg.ride?.originCity} → {leg.ride?.destinationCity} · {leg.ride?.departureTime ?? ''}
            </Text>
          </View>
          <Chip
            label={
              leg.status === 'accepted'
                ? 'Accepted'
                : leg.status === 'rejected' || leg.status === 'cancelled'
                  ? "Couldn't take this booking"
                  : 'Waiting'
            }
            tone={leg.status === 'accepted' ? 'blue' : 'grey'}
          />
        </View>
      ))}
    </Screen>
  );
}

export type { Connection };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  leg: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  legTime: { ...typography.heading, color: colors.text, minWidth: 56 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  connector: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: 20 },
  body: { ...typography.body, color: colors.text },
  semi: { ...typography.bodySemibold, color: colors.text },
  node: { gap: spacing.xs },
  changeover: {
    backgroundColor: colors.brandSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  twoUp: { flexDirection: 'row', gap: spacing.md },
  header: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  headerTitle: { ...typography.title, color: colors.textOnBrand },
  headerLine: { ...typography.bodySemibold, color: colors.textOnBrand },
});
