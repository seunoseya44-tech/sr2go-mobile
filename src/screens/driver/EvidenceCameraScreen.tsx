import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Location from 'expo-location';
import * as ScreenCapture from 'expo-screen-capture';

import { tripApi, type EvidenceResult } from '../../api/trip';
import { Screen } from '../../components/Screen';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { shared } from '../booking/shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * S1 / S2 · Depart and Arrived photo. In-app camera only; the photo stays in
 * memory, goes up at once and is dropped. No skip (Martin, 20 Oct): if the
 * camera fails or there is no network, the location record goes without a
 * photo, automatically. "Photo sent ✓" for 3 s, then the next screen.
 */
export function EvidenceCameraScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'EvidenceCamera'>>();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [phase, setPhase] = useState<'camera' | 'sending' | 'sent'>('camera');
  const [result, setResult] = useState<EvidenceResult | null>(null);
  const [noPhoto, setNoPhoto] = useState(false);
  const isStart = params.event === 'journey_start';

  useEffect(() => {
    void ScreenCapture.preventScreenCaptureAsync().catch(() => undefined);
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
    return () => void ScreenCapture.allowScreenCaptureAsync().catch(() => undefined);
  }, [permission, requestPermission]);

  const next = () => {
    if (isStart) navigation.replace('ActiveTrip', { rideId: params.rideId });
    else navigation.replace('RatePassengers', { rideId: params.rideId });
  };

  const send = async (photoBase64: string | null) => {
    setPhase('sending');
    setNoPhoto(!photoBase64);
    let pos: Location.LocationObject | null = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted')
        pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    } catch {
      pos = null;
    }
    const payload = {
      event: params.event,
      latitude: pos?.coords.latitude ?? null,
      longitude: pos?.coords.longitude ?? null,
      accuracyM: pos?.coords.accuracy ?? null,
    };
    let res: EvidenceResult | null = null;
    // Up to three tries with the photo, then once without it: never block the driver.
    for (let i = 0; i < 3 && !res; i++) {
      try {
        res = await tripApi.evidence(params.rideId, { ...payload, photoBase64 });
      } catch {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    if (!res) {
      try {
        res = await tripApi.evidence(params.rideId, { ...payload, photoBase64: null });
      } catch {
        res = null;
      }
    }
    setResult(res);
    setPhase('sent');
    setTimeout(next, 3000);
  };

  const sendWithoutCamera = async () => {
    await send(null);
  };

  const take = async () => {
    try {
      const pic = await camera.current?.takePictureAsync({ quality: 0.7, skipProcessing: true });
      if (!pic) throw new Error('no picture');
      const small = await manipulateAsync(pic.uri, [{ resize: { width: 1024 } }], {
        compress: 0.6,
        format: SaveFormat.JPEG,
        base64: true,
      });
      await send(small.base64 ?? null);
    } catch {
      await send(null);
    }
  };

  // Camera permission refused or unavailable: the record still goes, without a photo.
  useEffect(() => {
    if (permission && !permission.granted && !permission.canAskAgain && phase === 'camera') {
      const t = setTimeout(() => void sendWithoutCamera(), 0);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted, permission?.canAskAgain]);

  if (phase === 'sent') {
    const when = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return (
      <Screen testID="evidence-sent" topBar={null}>
        <View style={shared.centered}>
          <View style={styles.check}>
            <Ionicons name="checkmark" size={40} color={colors.textOnBrand} />
          </View>
          <Text style={shared.heading}>
            {result?.photoStored || (result && !noPhoto) ? 'Photo sent ✓' : 'Location recorded ✓'}
          </Text>
          <Text style={shared.small}>
            {isStart ? 'Departed' : 'Arrived'}
            {result?.address ? ` · ${result.address}` : ''} · {when}
          </Text>
          {result && result.withinRadius === false && result.distanceKm != null ? (
            <View style={styles.tile}>
              <Text style={styles.tileText}>
                Recorded: {result.distanceKm.toFixed(1)} km from the{' '}
                {isStart ? 'pickup' : 'drop-off'} point
              </Text>
            </View>
          ) : null}
          {!result ? (
            <Text style={shared.small}>
              No signal. The record is sent when you are back online.
            </Text>
          ) : null}
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      testID="evidence-camera"
      topBar={null}
      background={colors.midnight}
      statusBar="light"
      scroll={false}
      contentStyle={styles.content}
    >
      <Text style={styles.title}>
        {isStart
          ? 'Take a photo of your passengers in the car'
          : 'Take a photo as your passengers get out'}
      </Text>
      <Text style={styles.sub}>Recorded with your location. Never saved on your phone.</Text>
      <View style={styles.preview}>
        {permission?.granted ? (
          <CameraView ref={camera} style={styles.camera} facing="back" />
        ) : null}
        {phase === 'sending' ? (
          <View style={styles.sendingOverlay}>
            <ActivityIndicator color={colors.brand} size="large" />
            <Text style={styles.sendingText}>Sending…</Text>
          </View>
        ) : null}
      </View>
      {phase === 'camera' && permission?.granted ? (
        <View style={styles.shutterRow}>
          <Pressable
            onPress={() => void take()}
            style={styles.shutter}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, gap: spacing.sm },
  title: { ...typography.heading, fontSize: 22, lineHeight: 28, color: colors.textOnBrand },
  sub: { ...typography.secondary, color: '#B8C4D4' },
  preview: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#1F2A3C',
    minHeight: 320,
  },
  camera: { flex: 1 },
  sendingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,22,40,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  sendingText: { ...typography.body, color: colors.textOnBrand },
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
  check: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    backgroundColor: colors.tile,
    borderRadius: radius.md,
    padding: spacing.md,
    alignSelf: 'stretch',
  },
  tileText: { ...typography.body, color: colors.navy, textAlign: 'center' },
});
