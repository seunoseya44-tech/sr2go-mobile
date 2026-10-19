import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Brightness from 'expo-brightness';

import { bookingsApi } from '../../api/bookings';
import { packs, usePendingSync } from '../../boarding/manager';
import { toApiError } from '../../api/errors';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { QrBox } from '../../components/QrBox';
import { Screen } from '../../components/Screen';
import type { AppStackParamList } from '../../navigation/types';
import { colors, fonts, radius, spacing, typography } from '../../theme';
import { shared } from './shared';

/**
 * Screen 30 · Boarding pass. Own QR big on top for the driver to scan, then
 * "Scan driver's QR" (next build: offline check from the boarding pack).
 * Cached by React Query so it still shows with no signal once loaded.
 */
export function BoardingPassScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'BoardingPass'>>();
  const pending = usePendingSync();
  const pack = useQuery({
    queryKey: ['passenger-pack', params.bookingId],
    queryFn: () => packs.passenger(params.bookingId),
    staleTime: 5 * 60_000,
  });
  const { isInternetReachable } = useNetInfo();
  const offline = isInternetReachable === false;

  const pass = useQuery({
    queryKey: ['boarding-pass', params.bookingId],
    queryFn: () => bookingsApi.boardingPass(params.bookingId),
    staleTime: 60 * 60 * 1000,
    gcTime: 48 * 60 * 60 * 1000,
    retry: 1,
  });
  const booking = useQuery({
    queryKey: ['bookings', params.bookingId],
    queryFn: () => bookingsApi.get(params.bookingId),
    staleTime: 10 * 60 * 1000,
  });

  // Screen brightness up while the pass is open; restored on close.
  useEffect(() => {
    let previous: number | null = null;
    void (async () => {
      try {
        const { status } = await Brightness.getPermissionsAsync();
        if (status !== 'granted') return;
        previous = await Brightness.getBrightnessAsync();
        await Brightness.setBrightnessAsync(1);
      } catch {
        /* brightness is a nicety, never an error */
      }
    })();
    return () => {
      if (previous != null) void Brightness.setBrightnessAsync(previous).catch(() => undefined);
    };
  }, []);

  const p = pass.data ?? null;
  const b = booking.data ?? null;
  const qr = pack.data?.myQr ?? p?.qrPayload ?? b?.qrCodeData ?? null;
  const code = pack.data?.boardingCode ?? p?.boardingCode ?? b?.boardingCode ?? null;
  const vehicle = p?.driver.vehicle
    ? [p.driver.vehicle.colour, p.driver.vehicle.model, p.driver.vehicle.plate]
        .filter(Boolean)
        .join(' · ')
    : [b?.vehicle, b?.plate].filter(Boolean).join(' · ');

  return (
    <Screen
      testID="boarding-pass"
      topBar={{ title: 'Boarding pass', leading: 'close' }}
      footer={
        <>
          <Button
            title="Scan driver's QR"
            icon="qr-code-outline"
            onPress={() => navigation.navigate('ScanDriver', { bookingId: params.bookingId })}
          />
          {offline ? (
            <Text style={shared.small}>No signal - scan the QR instead.</Text>
          ) : (
            <Text style={shared.small}>
              Type the driver code: available at the car with signal.
            </Text>
          )}
        </>
      }
    >
      <Text style={shared.subtitle}>Your driver scans this before you get in.</Text>
      {pass.isError && !qr ? (
        <Banner tone="error" message={toApiError(pass.error).message} />
      ) : null}

      <View style={styles.card}>
        {pass.isPending && pack.isPending && !qr ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          <QrBox value={qr} code={code} size={220} />
        )}
        <Text style={shared.overline}>Boarding code</Text>
        <Text style={styles.code}>{code ? code.split('').join(' ') : '— — — —'}</Text>
      </View>

      <View style={styles.kv}>
        <Text style={styles.k}>Driver</Text>
        <View style={styles.row}>
          <Text style={styles.v}>{p?.driver.name ?? b?.driverName ?? '—'}</Text>
          {(p?.driver.verified ?? b?.driverVerified) ? (
            <Ionicons name="checkmark-circle" size={18} color={colors.brand} />
          ) : null}
        </View>
      </View>
      <View style={styles.kv}>
        <Text style={styles.k}>Car</Text>
        <Text style={styles.v}>{vehicle || '—'}</Text>
      </View>

      <View style={styles.row}>
        <Ionicons name="phone-portrait-outline" size={16} color={colors.textMuted} />
        <Text style={shared.small}>
          {pending > 0
            ? 'Saved - will send when you’re back online.'
            : pack.data
              ? 'Stored on this phone · works without internet'
              : 'Open the app with signal before departure so this pass works offline.'}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  code: {
    fontFamily: fonts.displayBold,
    fontSize: 36,
    lineHeight: 44,
    color: colors.text,
    letterSpacing: 4,
  },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  k: { ...typography.body, color: colors.textMuted },
  v: { ...typography.body, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, justifyContent: 'center' },
});
