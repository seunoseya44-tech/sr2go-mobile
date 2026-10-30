import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNetInfo } from '@react-native-community/netinfo';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ScreenCapture from 'expo-screen-capture';

import { bookingsApi } from '../../api/bookings';
import { toApiError } from '../../api/errors';
import { packs, recordCheck, usePendingSync } from '../../boarding/manager';
import { packStore } from '../../boarding/store';
import { checkTripQr, QR_FAILURE_MESSAGE } from '../../boarding/token';
import { SUPPORT_PHONE_FALLBACK } from '../../boarding/types';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { InfoBanner, LinkText } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { ResultIcon, shared } from './shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * A2 · Scan your driver. The trip QR is checked on the phone against the
 * boarding pack (signature, ride, driver, expiry); no network needed. With no
 * pack and signal, the online scan-driver call is used. Typed codes need
 * signal (the server limits wrong tries).
 */
export function ScanDriverScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'ScanDriver'>>();
  const { isInternetReachable } = useNetInfo();
  const offline = isInternetReachable === false;
  const [permission, requestPermission] = useCameraPermissions();
  const [typing, setTyping] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const pack = useQuery({
    queryKey: ['passenger-pack', params.bookingId],
    queryFn: () => packs.passenger(params.bookingId),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  const check = useMutation({
    mutationFn: async (input: { qr?: string; pin?: string }) => {
      const p = pack.data ?? (await packStore.getPassenger(params.bookingId));
      if (input.qr && p) {
        const res = checkTripQr(
          input.qr,
          { rideId: p.rideId, driverUserId: p.driver.userId, publicKey: p.key.publicKey },
          Math.floor(Date.now() / 1000) + p.clockOffsetSeconds,
        );
        if (!res.ok) throw new Error(QR_FAILURE_MESSAGE);
        let photo = await packStore.photoUri('passenger', params.bookingId, 'driver');
        // Item 16: no stored photo yet -> fetch a fresh signed link while there is signal.
        if (!photo) {
          photo = await bookingsApi
            .scanDriver(params.bookingId, input.qr)
            .then((r) => r.photo)
            .catch(() => null);
        }
        return {
          scanned: input.qr,
          name: p.driver.name,
          verified: p.driver.verified,
          photo,
          vehicle: vehicleLine(p.driver.vehicle),
          offline: true,
        };
      }
      if (offline) throw new Error('No signal - scan the QR instead.');
      const res = await bookingsApi.scanDriver(params.bookingId, input.qr ?? input.pin!);
      return {
        scanned: input.qr ?? input.pin!,
        name: res.name,
        verified: res.verified,
        photo: res.photo,
        vehicle: res.vehicle,
        offline: false,
      };
    },
    onSuccess: (res) => {
      busy.current = false;
      navigation.replace('ConfirmDriver', { bookingId: params.bookingId, ...res });
    },
    onError: (e) => {
      busy.current = false;
      const err = toApiError(e);
      setError(err.kind === 'unknown' && e instanceof Error ? e.message : err.message);
    },
  });

  return (
    <Screen
      testID="scan-driver"
      topBar={{ title: 'Scan your driver', leading: 'close' }}
      background={colors.midnight}
      statusBar="light"
      scroll={false}
      footer={
        typing ? (
          <>
            <Button
              title="Check code"
              onPress={() => check.mutate({ pin: code })}
              disabled={code.length !== 4 || offline}
              loading={check.isPending}
            />
            {offline ? (
              <Text style={[shared.small, styles.light]}>No signal - scan the QR instead.</Text>
            ) : null}
            <LinkText onPress={() => setTyping(false)} style={styles.center}>
              Scan the QR instead
            </LinkText>
          </>
        ) : offline ? (
          <Text style={[shared.small, styles.light]}>No signal - scan the QR instead.</Text>
        ) : (
          <LinkText onPress={() => setTyping(true)} style={styles.center}>
            Type the driver code instead
          </LinkText>
        )
      }
    >
      <Text style={[shared.subtitle, styles.light, styles.centerText]}>
        Step 1 of 2 · Point at the QR on your driver&apos;s phone
      </Text>
      {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      {typing ? (
        <View style={styles.typeBox}>
          <TextField
            label="Driver's 4-digit code"
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
          <View style={[styles.frame, error ? styles.frameError : null]} pointerEvents="none" />
          {check.isPending ? (
            <ActivityIndicator color={colors.textOnBrand} style={styles.spinner} />
          ) : null}
        </View>
      ) : (
        <View style={shared.centered}>
          <Text style={[shared.body, styles.light]}>
            Camera access is needed to check your driver.
          </Text>
          <Button title="Allow camera" onPress={() => void requestPermission()} />
        </View>
      )}
      {!pack.data && !pack.isPending ? (
        <Text style={[shared.small, styles.light, styles.centerText]}>
          {offline
            ? 'Move to where there is signal, or ask your driver to scan your QR.'
            : 'Your boarding pack is not on this phone yet; the check runs online.'}
        </Text>
      ) : null}
    </Screen>
  );
}

function vehicleLine(
  v: {
    make: string | null;
    model: string | null;
    colour: string | null;
    plate: string | null;
  } | null,
): string | null {
  if (!v) return null;
  const s = [v.colour, v.make, v.model].filter(Boolean).join(' ');
  return [s, v.plate].filter(Boolean).join(' · ') || null;
}

/** A3 · Confirm your driver, A4 · Not my driver, A4b/A6 held. */
export function ConfirmDriverScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'ConfirmDriver'>>();
  const pending = usePendingSync();
  const [noMatch, setNoMatch] = useState(false);
  const [reason, setReason] = useState('');
  const [held, setHeld] = useState<string | null>(null);

  useEffect(() => {
    void ScreenCapture.preventScreenCaptureAsync().catch(() => undefined);
    return () => void ScreenCapture.allowScreenCaptureAsync().catch(() => undefined);
  }, []);

  const confirm = useMutation({
    mutationFn: async (matched: boolean) => {
      if (params.offline) {
        await recordCheck({
          bookingId: params.bookingId,
          side: 'passenger',
          scanned: params.scanned,
          faceMatched: matched,
          reason: matched ? null : reason,
        });
        return null;
      }
      return bookingsApi.passengerConfirm(params.bookingId, matched, matched ? undefined : reason);
    },
    onSuccess: (message, matched) => {
      if (matched) navigation.replace('BoardingPass', { bookingId: params.bookingId });
      else setHeld(message ?? 'Do not get in. SR2Go will contact you.');
    },
  });

  if (held) {
    return (
      <Screen
        testID="confirm-driver"
        topBar={{
          leading: 'close',
          onLeadingPress: () => navigation.navigate('Main', { screen: 'Trips' }),
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
              onPress={() => navigation.navigate('Main', { screen: 'Trips' })}
              style={styles.center}
            >
              Back to my trips
            </LinkText>
          </>
        }
      >
        <View style={shared.centered}>
          <ResultIcon icon="alert" tone="red" />
          <Text style={shared.heading}>Do not get in. SR2Go will contact you.</Text>
          <Text style={shared.body}>{held}</Text>
          <Text style={shared.small}>
            This booking is on hold for SR2Go to review. It cannot be cancelled from the app while
            on hold.
          </Text>
          {pending > 0 ? (
            <Text style={shared.small}>Saved - will send when you’re back online.</Text>
          ) : null}
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      testID="confirm-driver"
      topBar={{ title: 'Confirm your driver', leading: 'none' }}
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
          accessibilityLabel="Driver's verified photo"
        />
      ) : (
        <View style={[styles.photo, styles.photoEmpty]}>
          <Ionicons name="person-outline" size={48} color={colors.navy} />
          <Text style={shared.small}>Photo not available on this phone</Text>
        </View>
      )}
      <View style={styles.nameRow}>
        <Text style={styles.name}>{params.name ?? 'Driver'}</Text>
        {params.verified ? (
          <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
        ) : null}
      </View>
      {params.vehicle ? <Text style={shared.subtitle}>{params.vehicle}</Text> : null}
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
          <InfoBanner tone="red">Do not get in.</InfoBanner>
        </>
      ) : (
        <Text style={styles.question}>Is this your driver?</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  light: { color: colors.textOnBrand },
  center: { alignSelf: 'center' },
  centerText: { textAlign: 'center' },
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
  frameError: { borderColor: colors.danger },
  spinner: { position: 'absolute', top: '48%', alignSelf: 'center' },
  typeBox: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md },
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.tile },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { ...typography.title, color: colors.text },
  question: { ...typography.heading, color: colors.text },
});
