import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ScreenCapture from 'expo-screen-capture';

import { packs, recordCheck, usePendingSync } from '../../boarding/manager';
import { packStore } from '../../boarding/store';
import { checkPassengerQr, QR_FAILURE_MESSAGE } from '../../boarding/token';
import { driverApi, type RideBooking } from '../../api/driver';
import { toApiError } from '../../api/errors';
import { SUPPORT_PHONE_FALLBACK } from '../../boarding/types';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { QrBox } from '../../components/QrBox';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { Avatar, Chip, InfoBanner, LinkText } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { shortDate } from '../../utils/format';
import { ResultIcon, shared } from '../booking/shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * A1 · Boarding (driver): the ONE trip QR every passenger scans, "Scan
 * passengers", and the paid passenger list. The trip QR comes from the driver
 * pack; until it is downloadable the screen still lets the driver scan.
 */
export function DriverBoardingScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'DriverBoarding'>>();
  const ride = useQuery({
    queryKey: ['ride', params.rideId],
    queryFn: () => driverApi.ride(params.rideId),
  });
  const pending = usePendingSync();
  const pack = useQuery({
    queryKey: ['driver-pack', params.rideId],
    queryFn: () => packs.driver(params.rideId),
    retry: false,
    staleTime: 5 * 60_000,
  });
  const bookings = useQuery({
    queryKey: ['ride-bookings', params.rideId],
    queryFn: () => driverApi.rideBookings(params.rideId),
    refetchInterval: 20_000,
  });
  const start = useMutation({
    mutationFn: () => driverApi.startRide(params.rideId),
    onSuccess: () => navigation.replace('ActiveTrip', { rideId: params.rideId }),
  });
  const paid = (bookings.data ?? []).filter((b) => b.paid);
  const packError = pack.isError ? toApiError(pack.error) : null;
  const r = ride.data;

  return (
    <Screen
      testID="driver-boarding"
      topBar={{ title: 'Boarding', leading: 'close' }}
      footer={
        <>
          <Button
            title="Scan passengers"
            icon="scan-outline"
            onPress={() => navigation.navigate('ScanPassenger', { rideId: params.rideId })}
          />
          <Button
            title="Start ride"
            variant="secondary"
            onPress={() => start.mutate()}
            loading={start.isPending}
            disabled={paid.length === 0}
          />
        </>
      }
    >
      {r ? (
        <Text style={shared.subtitle}>
          {shortDate(r.departureDate)} · {r.departureTime} · {r.originCity} → {r.destinationCity}
        </Text>
      ) : null}
      {start.isError ? <Banner tone="error" message={toApiError(start.error).message} /> : null}
      <View style={styles.qrCard}>
        {pack.isPending ? (
          <ActivityIndicator color={colors.brand} />
        ) : pack.data?.tripQr ? (
          <QrBox value={pack.data.tripQr} size={160} />
        ) : (
          <Text style={shared.small}>
            {packError?.message ?? 'The trip QR is available from 24 hours before departure.'}
          </Text>
        )}
        <Text style={shared.overline}>Trip QR · every passenger scans this</Text>
      </View>
      <Text style={shared.subtitle}>Passengers scan you first, then you scan each of them.</Text>
      {bookings.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {paid.map((b) => (
        <View key={b.id} style={styles.row}>
          <Avatar name={b.passengerName} size={40} verified={b.passengerVerified} />
          <View style={styles.flex}>
            <Text style={styles.semi}>{b.passengerName ?? 'Passenger'}</Text>
            <Text style={shared.subtitle}>
              {b.seats} seat{b.seats === 1 ? '' : 's'}
              {b.children ? ` · ${b.children} child${b.children === 1 ? '' : 'ren'}` : ''}
            </Text>
          </View>
          <Chip
            label={b.heldForReview ? 'On hold' : b.boarded ? 'Boarded' : 'Waiting'}
            tone={b.boarded ? 'blue' : 'grey'}
          />
        </View>
      ))}
      {!bookings.isPending && paid.length === 0 ? (
        <Text style={shared.subtitle}>No paid passengers yet.</Text>
      ) : null}
      <View style={styles.rowCenter}>
        <Ionicons name="cloud-upload-outline" size={16} color={colors.textMuted} />
        <Text style={shared.small}>
          {pending > 0
            ? 'Saved - will send when you’re back online.'
            : pack.data
              ? 'Boarding pack on this phone · works without signal'
              : 'Open the app with signal before departure to board without data.'}
        </Text>
      </View>
    </Screen>
  );
}

/** Scan a passenger's QR, or type their 4-digit code. Camera stays open between scans. */
export function ScanPassengerScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'ScanPassenger'>>();
  const [permission, requestPermission] = useCameraPermissions();
  const [typing, setTyping] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const bookings = useQuery({
    queryKey: ['ride-bookings', params.rideId],
    queryFn: () => driverApi.rideBookings(params.rideId),
  });

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  const check = useMutation({
    mutationFn: async (input: { qr?: string; pin?: string }) => {
      // Offline first: a QR is checked against the driver pack on the phone.
      if (input.qr) {
        const pack = await packStore.getDriver(params.rideId);
        if (pack) {
          const res = checkPassengerQr(
            input.qr,
            {
              rideId: pack.rideId,
              publicKey: pack.key.publicKey,
              passengers: pack.passengers.map((p) => ({
                bookingId: p.bookingId,
                passengerId: p.passengerId,
              })),
            },
            Math.floor(Date.now() / 1000) + pack.clockOffsetSeconds,
          );
          if (!res.ok) throw new Error(QR_FAILURE_MESSAGE);
          const p = pack.passengers.find((x) => x.bookingId === res.payload.b)!;
          if (p.heldForReview)
            throw new Error('This booking is on hold. Do not board. SR2Go will contact you.');
          const photo = await packStore.photoUri('driver', params.rideId, p.bookingId);
          return {
            bookingId: p.bookingId,
            passengerName: p.name,
            passengerPhoto: photo,
            seats: p.seatsBooked,
            children: p.children,
            message: null,
            scanned: input.qr,
            offline: true,
          };
        }
      }
      // The online calls need a booking id; with a token we can read it from the payload.
      const list = bookings.data ?? (await driverApi.rideBookings(params.rideId));
      let bookingId = params.bookingId ?? null;
      if (input.qr) bookingId = bookingIdFromToken(input.qr) ?? bookingId;
      if (!bookingId && input.pin) {
        // Try each unboarded paid passenger until the code matches.
        for (const b of list.filter((x) => x.paid && !x.boarded)) {
          try {
            const res = await driverApi.verifyPin(b.id, input.pin);
            return {
              ...res,
              bookingId: res.bookingId ?? b.id,
              scanned: input.pin!,
              offline: false,
            };
          } catch (e) {
            if (toApiError(e).status === 429) throw e;
          }
        }
        throw new Error('This code is not for this trip.');
      }
      if (!bookingId) throw new Error('This code is not for this trip.');
      const res = input.qr
        ? await driverApi.scanQr(bookingId, input.qr)
        : await driverApi.verifyPin(bookingId, input.pin!);
      return {
        ...res,
        bookingId: res.bookingId ?? bookingId,
        scanned: input.qr ?? input.pin!,
        offline: false,
      };
    },
    onSuccess: (res) => {
      busy.current = false;
      navigation.replace('ConfirmPassenger', {
        rideId: params.rideId,
        bookingId: res.bookingId!,
        name: res.passengerName,
        photo: res.passengerPhoto,
        seats: res.seats,
        children: res.children,
        scanned: res.scanned,
        offline: res.offline,
      });
    },
    onError: (e) => {
      busy.current = false;
      const err = toApiError(e);
      setError(err.kind === 'unknown' && e instanceof Error ? e.message : err.message);
    },
  });

  return (
    <Screen
      testID="scan-passenger"
      topBar={{ title: 'Scan passengers', leading: 'close' }}
      background={colors.midnight}
      statusBar="light"
      scroll={false}
      footer={
        typing ? (
          <>
            <Button
              title="Check code"
              onPress={() => check.mutate({ pin: code })}
              disabled={code.length !== 4}
              loading={check.isPending}
            />
            <LinkText onPress={() => setTyping(false)} style={styles.lightLink}>
              Scan the QR instead
            </LinkText>
          </>
        ) : (
          <LinkText onPress={() => setTyping(true)} style={styles.lightLink}>
            Type the passenger code instead
          </LinkText>
        )
      }
    >
      <Text style={[shared.subtitle, styles.light]}>
        The camera stays open: scan one passenger after another.
      </Text>
      {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      {typing ? (
        <View style={styles.typeBox}>
          <TextField
            label="Passenger's 4-digit code"
            keyboardType="number-pad"
            maxLength={4}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
            autoFocus
          />
        </View>
      ) : permission?.granted ? (
        <View style={styles.cameraWrap}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }: { data: string }) => {
              if (busy.current || check.isPending) return;
              busy.current = true;
              setError(null);
              check.mutate({ qr: data });
            }}
          />
          <View style={styles.frame} pointerEvents="none" />
          {check.isPending ? (
            <ActivityIndicator color={colors.textOnBrand} style={styles.spinner} />
          ) : null}
        </View>
      ) : (
        <View style={shared.centered}>
          <Text style={[shared.body, styles.light]}>
            Camera access is needed to scan boarding codes.
          </Text>
          <Button title="Allow camera" onPress={() => void requestPermission()} />
        </View>
      )}
      <Text style={[shared.body, styles.light, styles.center]}>
        Point at the passenger&apos;s QR
      </Text>
    </Screen>
  );
}

function bookingIdFromToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'S2G1') return null;
  try {
    const b64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(globalThis.atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
    return typeof json?.b === 'string' ? json.b : null;
  } catch {
    return null;
  }
}

/** Confirm passenger: the face, "Yes, it's them" / "Does not match" with a reason. */
export function ConfirmPassengerScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'ConfirmPassenger'>>();
  const queryClient = useQueryClient();
  const [noMatch, setNoMatch] = useState(false);
  const [reason, setReason] = useState('');
  const [held, setHeld] = useState<string | null>(null);

  useEffect(() => {
    void ScreenCapture.preventScreenCaptureAsync().catch(() => undefined);
    return () => void ScreenCapture.allowScreenCaptureAsync().catch(() => undefined);
  }, []);

  const confirm = useMutation({
    mutationFn: async (matched: boolean) => {
      if (params.offline && params.scanned) {
        await recordCheck({
          bookingId: params.bookingId,
          side: 'driver',
          scanned: params.scanned,
          faceMatched: matched,
          reason: matched ? null : reason,
        });
        return null;
      }
      return driverApi.confirmBoarding(params.bookingId, matched, matched ? undefined : reason);
    },
    onSuccess: (message, matched) => {
      void queryClient.invalidateQueries({ queryKey: ['ride-bookings', params.rideId] });
      if (matched) navigation.replace('ScanPassenger', { rideId: params.rideId });
      else setHeld(message ?? 'Do not let this person board. SR2Go will contact you.');
    },
  });

  if (held) {
    return (
      <Screen
        testID="confirm-passenger"
        topBar={{
          leading: 'close',
          onLeadingPress: () => navigation.navigate('DriverBoarding', { rideId: params.rideId }),
        }}
        footer={
          <>
            <Button
              title="Call SR2Go"
              icon="call-outline"
              onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE_FALLBACK}`)}
            />
            <Button
              title="Call emergency 112"
              variant="danger"
              onPress={() => Linking.openURL('tel:112')}
            />
            <LinkText
              onPress={() => navigation.navigate('DriverBoarding', { rideId: params.rideId })}
              style={styles.center}
            >
              Back to boarding
            </LinkText>
          </>
        }
      >
        <View style={shared.centered}>
          <ResultIcon icon="alert" tone="red" />
          <Text style={shared.heading}>Do not board. SR2Go will contact you.</Text>
          <Text style={shared.body}>{held}</Text>
          <Text style={shared.small}>This booking is on hold for SR2Go to review.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      testID="confirm-passenger"
      topBar={{ title: 'Confirm passenger', leading: 'none' }}
      footer={
        noMatch ? (
          <Button
            title="Send report"
            variant="danger"
            onPress={() => confirm.mutate(false)}
            disabled={!reason.trim()}
            loading={confirm.isPending}
          />
        ) : (
          <>
            <Button
              title="Yes, it's them"
              onPress={() => confirm.mutate(true)}
              loading={confirm.isPending}
            />
            <Button title="Does not match" variant="danger" onPress={() => setNoMatch(true)} />
          </>
        )
      }
    >
      {confirm.isError ? <Banner tone="error" message={toApiError(confirm.error).message} /> : null}
      <InfoBanner>Code accepted. Now check the face.</InfoBanner>
      {params.photo ? (
        <Image
          source={{ uri: params.photo }}
          style={styles.photo}
          accessibilityLabel="Passenger's verified photo"
        />
      ) : (
        <View style={[styles.photo, styles.photoEmpty]}>
          <Ionicons name="person-outline" size={48} color={colors.navy} />
          <Text style={shared.small}>No photo on file</Text>
        </View>
      )}
      <Text style={styles.name}>
        {params.name ?? 'Passenger'}
        {params.children ? ` + ${params.children} child${params.children === 1 ? '' : 'ren'}` : ''}
      </Text>
      {params.seats ? (
        <Text style={shared.subtitle}>
          {params.seats} seat{params.seats === 1 ? '' : 's'}
        </Text>
      ) : null}
      {noMatch ? (
        <>
          <TextField
            label="Why doesn't it match?"
            placeholder="Required"
            value={reason}
            onChangeText={setReason}
            multiline
            autoFocus
          />
          <InfoBanner tone="red">Do not let this person board.</InfoBanner>
        </>
      ) : (
        <Text style={styles.question}>Is this the person in front of you?</Text>
      )}
    </Screen>
  );
}

export type { RideBooking };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  qrCard: {
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  semi: { ...typography.bodySemibold, color: colors.text },
  light: { color: colors.textOnBrand },
  lightLink: { alignSelf: 'center' },
  center: { textAlign: 'center', alignSelf: 'center' },
  cameraWrap: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#1F2A3C',
    minHeight: 320,
  },
  camera: { flex: 1 },
  frame: {
    position: 'absolute',
    top: '15%',
    left: '15%',
    right: '15%',
    bottom: '15%',
    borderWidth: 3,
    borderColor: colors.brand,
    borderRadius: radius.lg,
  },
  spinner: { position: 'absolute', top: '48%', alignSelf: 'center' },
  typeBox: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md },
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.tile },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  name: { ...typography.title, color: colors.text },
  question: { ...typography.heading, color: colors.text },
});
