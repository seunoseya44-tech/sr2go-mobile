import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { toApiError } from '../api/errors';
import { ridesApi } from '../api/rides';
import type { Preference, Ride } from '../api/types';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Avatar, Card, Chip, InfoBanner, LinkText, PriceBlock } from '../components/ui';
import { env } from '../config/env';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { shortDate, vehicleLabel } from '../utils/format';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type IconName = keyof typeof Ionicons.glyphMap;

function prefLabel(p: Preference): string {
  return p === 'ask' ? 'ask' : (p ?? '—');
}

export function openDirections(lat: number, lng: number, label: string) {
  const q = encodeURIComponent(label);
  const url =
    Platform.OS === 'ios'
      ? `maps:0,0?q=${q}@${lat},${lng}`
      : `geo:${lat},${lng}?q=${lat},${lng}(${q})`;
  return Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`),
  );
}

/** Screen 09: Ride details. Map is static; plate is never shown before payment. */
export function RideDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'RideDetails'>>();
  const query = useQuery({
    queryKey: ['ride', params.rideId],
    queryFn: () => ridesApi.get(params.rideId),
  });

  if (query.isPending) {
    return (
      <Screen testID="ride-details" topBar={{ title: 'Ride details' }}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Screen testID="ride-details" topBar={{ title: 'Ride details' }}>
        <Banner
          tone="error"
          message={query.isError ? toApiError(query.error).message : "We couldn't find this ride."}
        />
        <Button title="Try again" variant="secondary" onPress={() => void query.refetch()} />
      </Screen>
    );
  }

  const ride = query.data;
  return (
    <Screen
      testID="ride-details"
      topBar={{ title: 'Ride details' }}
      footer={<BottomBar ride={ride} />}
    >
      <View style={styles.map} accessibilityLabel="Route map">
        <Ionicons name="map-outline" size={28} color={colors.navy} />
        <Text style={styles.mapText}>
          {ride.originCity ?? 'Origin'} → {ride.destinationCity ?? 'Destination'}
        </Text>
      </View>

      <View style={styles.summary}>
        <Text style={styles.when}>
          {shortDate(ride.departureDate)} · {ride.departureTime ?? ''}
        </Text>
        <Text style={styles.meta}>
          {ride.originCity} → {ride.destinationCity} · {vehicleLabel(ride.vehicleType)}
        </Text>
        <View style={styles.row}>
          {ride.seatsLeft != null ? (
            <Chip label={`${ride.seatsLeft} seats left`} tone="blue" />
          ) : null}
          <LinkText onPress={() => Linking.openURL(`${env.websiteUrl}/terms#cancellation`)}>
            See cancellation policy
          </LinkText>
        </View>
      </View>

      {ride.meetingPointName ? (
        <Card testID="meeting-point">
          <View style={styles.rowTop}>
            <Ionicons name="location-outline" size={22} color={colors.brand} />
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{ride.meetingPointName}</Text>
              {ride.meetingPointAddress ? (
                <Text style={styles.meta}>{ride.meetingPointAddress}</Text>
              ) : null}
            </View>
            {ride.meetingPointLat != null && ride.meetingPointLng != null ? (
              <LinkText
                onPress={() =>
                  void openDirections(
                    ride.meetingPointLat!,
                    ride.meetingPointLng!,
                    ride.meetingPointName!,
                  )
                }
              >
                Directions
              </LinkText>
            ) : null}
          </View>
        </Card>
      ) : null}

      <View style={styles.driverRow}>
        <Avatar name={ride.driverName} size={44} verified={ride.driverVerified} />
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{ride.driverName ?? 'Driver'}</Text>
          <Text style={styles.meta}>
            {ride.driverRating != null ? `★ ${ride.driverRating.toFixed(1)}` : ''}
            {ride.driverTripsCompleted != null ? ` · ${ride.driverTripsCompleted} trips` : ''}
          </Text>
        </View>
        {ride.driverId ? (
          <LinkText
            onPress={() =>
              navigation.navigate('DriverProfile', {
                driverId: ride.driverId!,
                name: ride.driverName,
              })
            }
            testID="view-profile"
          >
            View profile ›
          </LinkText>
        ) : null}
      </View>

      <View style={styles.badges}>
        <Chip
          label={ride.autoApprove ? 'Instant booking' : 'Driver approves requests'}
          tone="blue"
          icon={ride.autoApprove ? 'flash-outline' : undefined}
        />
        {ride.isAc ? <Chip label="AC" tone="blue" /> : null}
      </View>

      <View style={styles.prefGrid}>
        <Pref icon="musical-notes-outline" label="Music" value={ride.prefMusic} />
        <Pref icon="paw-outline" label="Pets" value={ride.prefPets} />
        <Pref icon="chatbubble-ellipses-outline" label="Chat" value={ride.prefChat} />
        <Pref icon="ban-outline" label="Smoking" value={ride.prefSmoking} />
      </View>

      <View style={styles.row}>
        <Ionicons name="briefcase-outline" size={18} color={colors.textMuted} />
        <Text style={styles.body}>
          Luggage:{' '}
          {ride.maxLuggageKg != null ? `up to ${ride.maxLuggageKg} kg` : 'no luggage limit'}
          {ride.luggageNote ? ` · ${ride.luggageNote}` : ''}
        </Text>
      </View>

      {ride.notes ? (
        <Text style={styles.note}>Driver&apos;s note: &ldquo;{ride.notes}&rdquo;</Text>
      ) : null}

      {ride.driverSmokes ? (
        <InfoBanner tone="amber" testID="smokes-banner">
          This driver smokes. Only book if you are comfortable with that.
        </InfoBanner>
      ) : null}
    </Screen>
  );
}

function BottomBar({ ride }: { ride: Ride }) {
  const navigation = useNavigation<Nav>();
  return (
    <View style={styles.bottomBar}>
      <PriceBlock
        payAmount={ride.payAmount}
        usualFare={ride.usualFare}
        savingsPct={ride.savingsPct}
        align="left"
      />
      <Button
        title={ride.autoApprove ? 'Book seat' : 'Request to book'}
        onPress={() => navigation.navigate('BookSeat', { rideId: ride.id })}
        disabled={ride.seatsLeft === 0}
        style={styles.bookButton}
        testID="book-button"
      />
    </View>
  );
}

function Pref({ icon, label, value }: { icon: IconName; label: string; value: Preference }) {
  return (
    <View style={styles.pref}>
      <Ionicons name={icon} size={18} color={colors.navy} />
      <Text style={styles.prefText}>
        {label}: {prefLabel(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', paddingVertical: spacing.xxl },
  map: {
    height: 150,
    borderRadius: radius.lg,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  mapText: { ...typography.secondary, color: colors.navy },
  summary: { gap: spacing.xs },
  when: { ...typography.heading, color: colors.text },
  meta: { ...typography.secondary, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitle: { ...typography.bodySemibold, color: colors.text },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  prefGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pref: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 32,
  },
  prefText: { ...typography.secondary, color: colors.text },
  body: { ...typography.body, color: colors.text, flex: 1 },
  note: { ...typography.body, color: colors.textMuted, fontStyle: 'italic' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bookButton: { flex: 1 },
});
