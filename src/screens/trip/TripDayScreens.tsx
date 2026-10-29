import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Location from 'expo-location';

import { bookingsApi } from '../../api/bookings';
import { ENDPOINTS, http } from '../../api/client';
import { toApiError } from '../../api/errors';
import { tripApi } from '../../api/trip';
import { disputeRoomsApi } from '../../api/social';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TrackingMap } from '../../components/TrackingMap';
import { Avatar, Chip, InfoBanner, LinkText } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { shortDate } from '../../utils/format';
import { openDirections } from '../RideDetailsScreen';
import { readEmergencyContact } from '../profile/ProfileScreens';
import { shared } from '../booking/shared';
import { lagosDateTime } from '../../utils/time';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * Screens 29 + 33 (passenger) · Trip day: driver arrived with the plate photo,
 * then the active trip with the car's position every 5 min, the contact card,
 * the meeting point, Share my trip and one-tap SOS.
 */
export function PassengerTripScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'PassengerTrip'>>();
  const booking = useQuery({
    queryKey: ['bookings', params.bookingId],
    queryFn: () => bookingsApi.get(params.bookingId),
    refetchInterval: 60_000,
  });
  const b = booking.data ?? null;
  const contacts = useQuery({
    queryKey: ['contacts', b?.rideId],
    queryFn: () => bookingsApi.contacts(b!.rideId!),
    enabled: !!b?.rideId,
    retry: false,
  });
  const link = useQuery({
    queryKey: ['tracking-link', params.bookingId],
    queryFn: () => bookingsApi.trackingLink(params.bookingId),
    retry: false,
  });
  const token = link.data?.trackingUrl?.split('/').filter(Boolean).pop() ?? null;
  const track = useQuery({
    queryKey: ['track', token],
    queryFn: () => tripApi.track(token!),
    enabled: !!token,
    refetchInterval: 5 * 60_000,
    retry: false,
  });
  const [plateDone, setPlateDone] = useState<string | null>(null);
  const rooms = useQuery({
    queryKey: ['dispute-rooms'],
    queryFn: disputeRoomsApi.rooms,
    retry: false,
  });
  const [showCamera, setShowCamera] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const contact = contacts.data?.contacts[0] ?? null;

  const share = useMutation({
    mutationFn: async () => {
      const l = link.data ?? (await bookingsApi.trackingLink(params.bookingId));
      if (l.whatsappLink && (await Linking.canOpenURL(l.whatsappLink)))
        return Linking.openURL(l.whatsappLink);
      await Share.share({ message: l.shareMessage ?? l.trackingUrl ?? '' });
    },
  });
  const sos = useMutation({
    mutationFn: async () => {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).catch(() => null);
      const contactSaved = await readEmergencyContact();
      await http.post(`${ENDPOINTS.bookings}/${params.bookingId}/sos`, {
        latitude: pos?.coords.latitude ?? null,
        longitude: pos?.coords.longitude ?? null,
        message: 'SOS from the passenger app',
        emergency_contact_phone: contactSaved?.phone ?? null,
      });
      return contactSaved?.phone ?? null;
    },
  });

  if (showCamera) {
    return (
      <PlateCamera
        onDone={(m) => {
          setPlateDone(
            m ??
              `Plate photo saved. ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          );
          setShowCamera(false);
        }}
        onCancel={() => setShowCamera(false)}
        bookingId={params.bookingId}
      />
    );
  }

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
              onPress={() => Linking.openURL('tel:+2349053451158')}
            />
            {sos.data ? (
              <Button
                title="Call my emergency contact"
                variant="outlineLight"
                onPress={() => Linking.openURL(`tel:${sos.data}`)}
              />
            ) : null}
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
            Sent {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·
            location shared
          </Text>
          <Text style={[shared.small, styles.onRed]}>
            If you are in immediate danger, call 112 first.
          </Text>
        </View>
      </Screen>
    );
  }

  const active = (track.data?.status ?? b?.ride?.raw?.status) === 'active';
  const mins = track.data?.lastUpdated
    ? Math.max(0, Math.round((now - Date.parse(track.data.lastUpdated)) / 60_000))
    : null;

  return (
    <Screen
      testID="passenger-trip"
      topBar={{
        leading: 'close',
        title: active ? `On the road to ${b?.destinationCity ?? ''}` : 'Your trip',
      }}
      footer={
        <Button
          title="Share my trip"
          icon="share-social-outline"
          onPress={() => share.mutate()}
          loading={share.isPending}
        />
      }
    >
      {!b ? <ActivityIndicator color={colors.brand} /> : null}
      {share.isError ? <Banner tone="error" message={toApiError(share.error).message} /> : null}
      {sos.isError ? <Banner tone="error" message={toApiError(sos.error).message} /> : null}
      {b ? (
        <Text style={shared.subtitle}>
          {b.originCity} → {b.destinationCity} · {shortDate(b.departureDate)}, {b.departureTime}
        </Text>
      ) : null}
      {active && track.data?.lat != null && track.data.lng != null ? (
        <TrackingMap
          car={{ lat: track.data.lat, lng: track.data.lng }}
          meetingPoint={
            b?.meetingPointLat != null && b.meetingPointLng != null
              ? { lat: b.meetingPointLat, lng: b.meetingPointLng, name: b.meetingPointName }
              : null
          }
        />
      ) : null}
      <View style={styles.map}>
        <Ionicons
          name={active ? 'car-outline' : 'location-outline'}
          size={28}
          color={colors.navy}
        />
        <Text style={shared.subtitle}>
          {active && track.data?.lat != null
            ? `Car position: ${track.data.lat.toFixed(4)}, ${track.data.lng?.toFixed(4)}`
            : active
              ? 'Waiting for the first position'
              : 'Positions appear once the driver starts the ride'}
        </Text>
        {active && track.data?.lat != null && track.data.lng != null ? (
          <LinkText
            onPress={() => void openDirections(track.data!.lat!, track.data!.lng!, 'Your ride')}
          >
            Open in Maps
          </LinkText>
        ) : null}
      </View>
      <View style={styles.rowBetween}>
        <Chip label={active ? 'On the road' : 'Before departure'} tone={active ? 'blue' : 'grey'} />
        {mins != null ? <Text style={shared.small}>Updated {mins} min ago</Text> : null}
      </View>

      {!active ? (
        <>
          <Text style={shared.overline}>Check before you get in</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Avatar name={b?.driverName ?? null} size={40} verified={b?.driverVerified} />
              <Text style={styles.semi}>{b?.driverName ?? 'Driver'}</Text>
            </View>
            {b?.vehicle ? <Row k="Car" v={b.vehicle} /> : null}
            {b?.plate ? <Row k="Plate" v={b.plate} /> : null}
          </View>
          {plateDone ? (
            <InfoBanner icon="checkmark-circle-outline">{plateDone}</InfoBanner>
          ) : (
            <Pressable
              onPress={() => setShowCamera(true)}
              style={styles.photoCard}
              accessibilityRole="button"
            >
              <Ionicons name="camera-outline" size={24} color={colors.navy} />
              <View style={styles.flex}>
                <Text style={styles.semi}>Photograph the plate</Text>
                <Text style={shared.subtitle}>
                  Takes 5 seconds. It helps if anything goes wrong.
                </Text>
              </View>
            </Pressable>
          )}
          <Button
            title="Show my boarding pass"
            onPress={() => navigation.navigate('BoardingPass', { bookingId: params.bookingId })}
          />
        </>
      ) : null}

      <View style={[styles.card, styles.row]}>
        <Avatar name={b?.driverName ?? null} size={40} verified={b?.driverVerified} />
        <View style={styles.flex}>
          <Text style={styles.semi}>{b?.driverName ?? 'Driver'}</Text>
          <Text style={shared.subtitle}>Driver{b?.vehicle ? ` · ${b.vehicle}` : ''}</Text>
          {contact?.phone ? (
            <Text style={styles.body}>{contact.phone}</Text>
          ) : contacts.data?.message ? (
            <Text style={shared.subtitle}>{contacts.data.message}</Text>
          ) : null}
        </View>
        {contact?.phone || contact?.callNumber ? (
          <Button
            title="Call"
            icon="call-outline"
            onPress={() =>
              Linking.openURL(`tel:${contact.callsMasked ? contact.callNumber : contact.phone}`)
            }
          />
        ) : null}
      </View>

      {b?.meetingPointName && !active ? (
        <View style={styles.card}>
          <Text style={shared.overline}>Meeting point</Text>
          <Text style={styles.semi}>{b.meetingPointName}</Text>
          {b.meetingPointLat != null && b.meetingPointLng != null ? (
            <LinkText
              onPress={() =>
                void openDirections(b.meetingPointLat!, b.meetingPointLng!, b.meetingPointName!)
              }
            >
              Get directions
            </LinkText>
          ) : null}
        </View>
      ) : null}

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
          One tap alerts SR2Go, your driver and your emergency contact
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
      <LinkText onPress={() => Linking.openURL('tel:+2349053451158')} style={styles.center}>
        Something doesn&apos;t match? Call SR2Go support
      </LinkText>
    </Screen>
  );
}

function PlateCamera({
  bookingId,
  onDone,
  onCancel,
}: {
  bookingId: string;
  onDone: (message: string | null) => void;
  onCancel: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);
  const take = async () => {
    setBusy(true);
    try {
      const pic = await camera.current?.takePictureAsync({ quality: 0.7 });
      if (!pic) throw new Error('No photo');
      const small = await manipulateAsync(pic.uri, [{ resize: { width: 1024 } }], {
        compress: 0.6,
        format: SaveFormat.JPEG,
        base64: true,
      });
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).catch(() => null);
      const m = await tripApi.plantePhoto(bookingId, {
        photoBase64: small.base64 ?? '',
        latitude: pos?.coords.latitude ?? null,
        longitude: pos?.coords.longitude ?? null,
        accuracyM: pos?.coords.accuracy ?? null,
      });
      onDone(m);
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      testID="plate-camera"
      topBar={{ leading: 'close', onLeadingPress: onCancel, title: 'Photograph the plate' }}
      background={colors.midnight}
      statusBar="light"
      scroll={false}
      contentStyle={styles.cameraContent}
    >
      {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      <View style={styles.preview}>
        {permission?.granted ? <CameraView ref={camera} style={styles.flex} facing="back" /> : null}
      </View>
      <View style={styles.shutterRow}>
        <Pressable
          onPress={() => void take()}
          style={styles.shutter}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          disabled={busy || !permission?.granted}
        >
          {busy ? <ActivityIndicator color={colors.brand} /> : <View style={styles.shutterInner} />}
        </Pressable>
      </View>
    </Screen>
  );
}

/** S3 · Journey record for the driver and the passenger. Never a photo. */
export function JourneyRecordScreen() {
  const { params } = useRoute<RouteProp<AppStackParamList, 'JourneyRecord'>>();
  const query = useQuery({
    queryKey: ['journey-record', params.rideId],
    queryFn: () => tripApi.journeyRecord(params.rideId),
    retry: false,
  });
  const r = query.data ?? null;
  const point = (
    label: string,
    p: typeof r extends null ? never : NonNullable<typeof r>['departed'],
    what: string,
  ) => (
    <View style={styles.card}>
      <Text style={shared.overline}>{label}</Text>
      {p ? (
        <>
          <Text style={styles.semi}>{p.address ?? '—'}</Text>
          {p.time ? <Text style={shared.subtitle}>{fmtTime(p.time)}</Text> : null}
          <View style={styles.row}>
            <Ionicons
              name={p.withinRadius === false ? 'time-outline' : 'checkmark-circle'}
              size={18}
              color={p.withinRadius === false ? colors.textMuted : colors.brand}
            />
            <Text style={shared.subtitle}>
              {p.withinRadius === false && p.distanceKm != null
                ? `${p.distanceKm.toFixed(1)} km from ${what}`
                : `within 1 km of ${what}`}
            </Text>
          </View>
          {p.lat != null && p.lng != null ? (
            <LinkText onPress={() => void openDirections(p.lat!, p.lng!, label)}>
              Open in Maps
            </LinkText>
          ) : null}
        </>
      ) : (
        <Text style={shared.subtitle}>Not recorded yet</Text>
      )}
    </View>
  );
  return (
    <Screen testID="journey-record" topBar={{ title: 'Journey record' }}>
      {params.route ? <Text style={shared.subtitle}>{params.route}</Text> : null}
      {query.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {query.isError ? <Banner tone="error" message={toApiError(query.error).message} /> : null}
      {r ? (
        <>
          <View style={styles.row}>
            <Ionicons
              name={r.allClear ? 'shield-checkmark' : 'information-circle-outline'}
              size={22}
              color={colors.navy}
            />
            <Text style={styles.body}>
              {r.allClear
                ? 'All clear'
                : `${r.flags.length || 1} note${r.flags.length === 1 ? '' : 's'} on this trip`}
            </Text>
          </View>
          {point('Departed', r.departed, 'pickup')}
          {point('Arrived', r.arrived, 'drop-off')}
          {r.flags.length > 0 ? (
            <>
              <Text style={shared.overline}>Notes</Text>
              {r.flags.map((f, i) => (
                <Text key={i} style={styles.body}>
                  {f}
                </Text>
              ))}
            </>
          ) : null}
          <Text style={styles.credit}>Addresses: © OpenStreetMap contributors</Text>
        </>
      ) : null}
    </Screen>
  );
}

function fmtTime(iso: string): string {
  // Item 9: Nigerian time, not the phone's zone.
  return lagosDateTime(iso).time ?? iso;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={shared.subtitle}>{k}</Text>
      <Text style={styles.semi}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignSelf: 'center' },
  map: {
    minHeight: 96,
    borderRadius: radius.lg,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  photoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.tile,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  semi: { ...typography.bodySemibold, color: colors.text },
  body: { ...typography.body, color: colors.text },
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
  cameraContent: { flex: 1, gap: spacing.sm },
  preview: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#1F2A3C',
    minHeight: 320,
  },
  shutterRow: { alignItems: 'center', paddingVertical: spacing.sm },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.brand,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  credit: { ...typography.label, color: colors.textMuted },
});
