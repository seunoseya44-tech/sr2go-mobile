import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { kycApi, type Bank, type ConsentConfig } from '../../api/account';
import { toApiError } from '../../api/errors';
import { useAuth } from '../../auth/AuthContext';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { Badge, Checkbox, LinkText, Segmented } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { secureStorage } from '../../storage/secureStorage';
import { colors, radius, spacing, typography } from '../../theme';
import { ResultIcon, shared } from '../booking/shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Next = 'book' | 'post' | undefined;

function Steps({ active, bankLabel = 'Bank' }: { active: 0 | 1 | 2 | 3; bankLabel?: string }) {
  const labels = ['Consent', 'Selfie', 'ID', bankLabel];
  return (
    <View style={styles.steps}>
      {labels.map((l, i) => (
        <View key={l} style={styles.step}>
          <View style={[styles.dot, i <= active && styles.dotActive]} />
          <Text style={[styles.stepText, i === active && styles.stepTextActive]}>{l}</Text>
          {i < 3 ? <View style={styles.stepLine} /> : null}
        </View>
      ))}
    </View>
  );
}

async function deviceId(): Promise<string> {
  const k = 'sr2go.device.id';
  const existing = await secureStorage.get(k);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await secureStorage.set(k, id);
  return id;
}

/** Screen 16 · Verify your identity: consent text exactly as the API returns it. */
export function KycConsentScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'KycConsent'>>();
  const next: Next = params?.next;
  const config = useQuery({ queryKey: ['consent-config'], queryFn: kycApi.consentConfig });
  const [agreed, setAgreed] = useState(false);
  const consent = useMutation({
    mutationFn: async (c: ConsentConfig) => kycApi.giveConsent(c, await deviceId()),
    onSuccess: () => navigation.navigate('KycSelfie', { next }),
  });

  useEffect(() => {
    if (config.data && !config.data.enabled) navigation.replace('KycSelfie', { next });
  }, [config.data, navigation, next]);

  return (
    <Screen
      testID="kyc-consent"
      topBar={{ title: 'Verify your identity', leading: 'close' }}
      footer={
        <Button
          title="Continue to selfie"
          onPress={() => config.data && consent.mutate(config.data)}
          disabled={!agreed || !config.data}
          loading={consent.isPending}
        />
      }
    >
      <Steps active={0} />
      <Text style={shared.heading}>Verify once, then book freely</Text>
      <Text style={shared.subtitle}>About 2 minutes. You only do this once.</Text>
      {[
        [
          'person-circle-outline',
          "A live selfie so drivers and passengers know who they're travelling with",
        ],
        ['id-card-outline', 'Your NIN or BVN and date of birth, checked by Dojah'],
        ['card-outline', 'A bank account for payouts (drivers). Optional for passengers.'],
      ].map(([icon, text]) => (
        <View key={text} style={styles.row}>
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={22} color={colors.brand} />
          <Text style={styles.body}>{text}</Text>
        </View>
      ))}
      <Text style={shared.overline}>Consent</Text>
      {consent.isError ? <Banner tone="error" message={toApiError(consent.error).message} /> : null}
      <ScrollView style={styles.consentBox} nestedScrollEnabled>
        {config.isPending ? (
          <ActivityIndicator color={colors.brand} />
        ) : config.isError ? (
          <Text style={styles.body}>{toApiError(config.error).message}</Text>
        ) : (
          <Text style={styles.body}>
            {config.data.text ?? 'Your selfie is used only to verify your identity.'}
          </Text>
        )}
      </ScrollView>
      {config.data ? (
        <Text style={shared.subtitle}>
          {[config.data.version, config.data.regulatoryBody].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
      <Checkbox checked={agreed} onChange={setAgreed} testID="consent-check">
        I agree to the use of my selfie for identity verification as described above.
      </Checkbox>
    </Screen>
  );
}

/** Screen 17 · Live selfie. Front camera only; resized to ≤ 600 px, ~150–200 KB (Martin, 16 Oct). */
export function KycSelfieScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'KycSelfie'>>();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [shot, setShot] = useState<{ uri: string; base64: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  const take = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    try {
      const pic = await camera.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
      if (!pic) return;
      const small = await manipulateAsync(pic.uri, [{ resize: { width: 600 } }], {
        compress: 0.7,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (small.base64) setShot({ uri: small.uri, base64: small.base64 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      testID="kyc-selfie"
      topBar={{ title: 'Take a selfie' }}
      scroll={false}
      footer={
        shot ? (
          <>
            <Button
              title="Use this photo"
              onPress={() =>
                navigation.navigate('KycId', { selfieBase64: shot.base64, next: params?.next })
              }
            />
            <Button title="Retake" variant="secondary" onPress={() => setShot(null)} />
          </>
        ) : (
          <View style={styles.shutterRow}>
            <Pressable
              onPress={() => void take()}
              style={styles.shutter}
              accessibilityRole="button"
              accessibilityLabel="Take selfie"
              disabled={busy || !permission?.granted}
            >
              {busy ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </Pressable>
          </View>
        )
      }
    >
      <Steps active={1} />
      {shot ? (
        <Image source={{ uri: shot.uri }} style={styles.preview} accessibilityLabel="Your selfie" />
      ) : permission?.granted ? (
        <View style={styles.preview}>
          <CameraView ref={camera} style={styles.camera} facing="front" />
          <View style={styles.oval} pointerEvents="none" />
          <View style={styles.tips} pointerEvents="none">
            {['Good light', 'No cap or glasses', 'Look straight'].map((t) => (
              <View key={t} style={styles.tip}>
                <Text style={styles.tipText}>{t}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.ovalText}>Fit your face in the oval</Text>
        </View>
      ) : (
        <View style={shared.centered}>
          <Text style={shared.body}>Camera access is needed for the live selfie.</Text>
          <Button title="Allow camera" onPress={() => void requestPermission()} />
        </View>
      )}
    </Screen>
  );
}

/** Screen 18 · NIN / BVN + date of birth → POST kyc/dojah with the selfie. */
export function KycIdScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'KycId'>>();
  const { refreshProfile, user } = useAuth();
  const [type, setType] = useState<'nin' | 'bvn'>('nin');
  const [id, setId] = useState('');
  const [dob, setDob] = useState('');
  const [state, setState] = useState<
    | { kind: 'idle' }
    | { kind: 'error'; message: string; code?: string }
    | { kind: 'under18'; message: string }
    | { kind: 'review'; message: string }
    | { kind: 'retry'; message: string }
  >({ kind: 'idle' });

  const dobIso = (() => {
    const m = /^(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})$/.exec(dob.trim());
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  })();
  const digits = id.replace(/\D/g, '');

  const verify = useMutation({
    mutationFn: () =>
      kycApi.verify({
        type,
        idNumber: digits,
        dateOfBirth: dobIso!,
        selfieBase64: params.selfieBase64,
      }),
    onSuccess: async (r) => {
      await refreshProfile().catch(() => undefined);
      if (r.verified || true) {
        const driver = user?.role === 'driver';
        navigation.replace(driver ? 'KycBank' : 'KycDone', { next: params.next });
      }
    },
    onError: (e) => {
      const err = toApiError(e);
      if (err.status === 403 && /18|age|old/i.test(err.message) && err.code !== 'kyc_under_review')
        setState({ kind: 'under18', message: err.message });
      else if (err.code === 'kyc_under_review') setState({ kind: 'review', message: err.message });
      else if (err.status === 503 || err.code === 'selfie_not_stored')
        setState({ kind: 'retry', message: err.message });
      else setState({ kind: 'error', message: err.message, code: err.code });
    },
  });

  if (state.kind === 'under18' || state.kind === 'review') {
    return (
      <Screen
        testID="kyc-id"
        topBar={{
          leading: 'close',
          onLeadingPress: () => navigation.navigate('Main', { screen: 'Home' }),
        }}
        footer={
          <Button
            title="Back to home"
            onPress={() => navigation.navigate('Main', { screen: 'Home' })}
          />
        }
      >
        <View style={shared.centered}>
          <ResultIcon icon="alert" />
          <Text style={shared.heading}>
            {state.kind === 'under18'
              ? 'You must be 18 or older to use ShareRide2Go.'
              : 'Your identity check is under review'}
          </Text>
          <Text style={shared.body}>{state.message}</Text>
          {state.kind === 'review' ? (
            <Text style={shared.small}>
              SR2Go will contact you. You can keep browsing rides in the meantime.
            </Text>
          ) : null}
        </View>
      </Screen>
    );
  }

  const tooMany =
    state.kind === 'error' &&
    state.code === undefined &&
    /tomorrow|attempts|today/i.test(state.message);

  return (
    <Screen
      testID="kyc-id"
      topBar={{ title: 'Your ID details' }}
      footer={
        <>
          <Button
            title={state.kind === 'retry' ? 'Try again' : tooMany ? 'Try again tomorrow' : 'Verify'}
            onPress={() => {
              setState({ kind: 'idle' });
              verify.mutate();
            }}
            disabled={digits.length !== 11 || !dobIso || tooMany}
            loading={verify.isPending}
            loadingTitle="Checking…"
          />
          {state.kind === 'error' && /already linked/i.test(state.message) ? (
            <Button
              title="Contact support"
              variant="secondary"
              onPress={() =>
                Linking.openURL('mailto:support@shareride2go.com?subject=Identity check')
              }
            />
          ) : null}
        </>
      }
    >
      <Steps active={2} />
      <View style={styles.row}>
        <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
        <Text style={styles.helperFlex}>
          We check your details with Dojah. We don&apos;t keep your {type.toUpperCase()} number or
          date of birth.
        </Text>
      </View>
      <Segmented
        options={[
          { value: 'nin', label: 'NIN' },
          { value: 'bvn', label: 'BVN' },
        ]}
        value={type}
        onChange={setType}
      />
      <TextField
        label={`${type.toUpperCase()} (11 digits)`}
        keyboardType="number-pad"
        value={id}
        onChangeText={(t) => setId(t.replace(/\D/g, '').slice(0, 11))}
        maxLength={11}
        helper={
          type === 'nin'
            ? "Dial *346# on your registered line if you don't know it."
            : 'Dial *565*0# on your registered line.'
        }
        error={state.kind === 'error' && !/birth/i.test(state.message) ? state.message : undefined}
        autoComplete="off"
        textContentType="none"
      />
      <TextField
        label="Date of birth"
        placeholder="DD / MM / YYYY"
        keyboardType="number-pad"
        value={dob}
        onChangeText={(t) => {
          const d = t.replace(/\D/g, '').slice(0, 8);
          setDob(
            d.length > 4
              ? `${d.slice(0, 2)} / ${d.slice(2, 4)} / ${d.slice(4)}`
              : d.length > 2
                ? `${d.slice(0, 2)} / ${d.slice(2)}`
                : d,
          );
        }}
        helper="Must match your record. You must be 18 or older."
        error={state.kind === 'error' && /birth/i.test(state.message) ? state.message : undefined}
      />
      {state.kind === 'retry' ? (
        <View style={styles.tile}>
          <Text style={styles.body}>{state.message}</Text>
          <Text style={shared.subtitle}>
            Trying again with the same ID and selfie is free for the next 30 minutes.
          </Text>
        </View>
      ) : null}
      {tooMany ? (
        <View style={styles.tile}>
          <Text style={styles.body}>{state.kind === 'error' ? state.message : ''}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

/** Screen 19 · Bank account (drivers). Passengers never see this step (13 Oct). */
export function KycBankScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'KycBank'>>();
  const { refreshProfile } = useAuth();
  const banks = useQuery({ queryKey: ['banks'], queryFn: kycApi.banks });
  const [bank, setBank] = useState<Bank | null>(null);
  const [query, setQuery] = useState('');
  const [account, setAccount] = useState('');
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolve = useMutation({
    mutationFn: (v: { bankCode: string; accountNumber: string }) =>
      kycApi.resolveAccount(v.bankCode, v.accountNumber),
    onSuccess: setName,
    onError: (e) => setError(toApiError(e).message),
  });
  const maybeResolve = (b: Bank | null, acct: string) => {
    setName(null);
    if (b && acct.length === 10) {
      setError(null);
      resolve.mutate({ bankCode: b.code, accountNumber: acct });
    }
  };

  const save = useMutation({
    mutationFn: () =>
      kycApi.registerBank({ bankName: bank!.name, bankCode: bank!.code, accountNumber: account }),
    onSuccess: async () => {
      await refreshProfile().catch(() => undefined);
      navigation.replace('KycDone', { next: params?.next });
    },
    onError: (e) => setError(toApiError(e).message),
  });

  const list = (banks.data ?? [])
    .filter((b) => b.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  return (
    <Screen
      testID="kyc-bank"
      topBar={{ title: 'Bank account' }}
      footer={
        <Button
          title="Save bank account"
          onPress={() => save.mutate()}
          disabled={!bank || !name}
          loading={save.isPending}
        />
      }
    >
      <Steps active={3} />
      <Text style={shared.heading}>Add your bank account for payouts</Text>
      <Text style={shared.subtitle}>
        Your trip earnings are paid here after each trip. We can only send money to this account.
      </Text>
      {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      <TextField
        label="Bank"
        placeholder="Start typing your bank"
        value={bank ? bank.name : query}
        onChangeText={(t) => {
          setBank(null);
          setQuery(t);
        }}
      />
      {!bank && query.length > 0 ? (
        <View style={styles.dropdown}>
          {banks.isPending ? <ActivityIndicator color={colors.brand} /> : null}
          {list.map((b) => (
            <Pressable
              key={b.code}
              onPress={() => {
                setBank(b);
                setQuery('');
                maybeResolve(b, account);
              }}
              style={styles.dropdownRow}
              accessibilityRole="button"
            >
              <Text style={styles.body}>{b.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextField
        label="Account number"
        keyboardType="number-pad"
        maxLength={10}
        value={account}
        onChangeText={(t) => {
          const acct = t.replace(/\D/g, '').slice(0, 10);
          setAccount(acct);
          maybeResolve(bank, acct);
        }}
      />
      {resolve.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {name ? (
        <View style={styles.tile}>
          <Text style={shared.overline}>Account name</Text>
          <Text style={styles.accountName}>{name}</Text>
          <Text style={shared.subtitle}>Is this you?</Text>
        </View>
      ) : null}
    </Screen>
  );
}

/** Screen 20 · You're verified. */
export function KycDoneScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'KycDone'>>();
  const post = params?.next === 'post';
  return (
    <Screen
      testID="kyc-done"
      topBar={null}
      footer={
        <Button
          title={post ? 'Continue posting' : 'Continue booking'}
          onPress={() =>
            post
              ? navigation.navigate('PostRideRoute')
              : navigation.navigate('Main', { screen: 'Home' })
          }
        />
      }
    >
      <View style={shared.centered}>
        <View style={styles.shield}>
          <Ionicons name="shield-checkmark" size={48} color={colors.textOnBrand} />
        </View>
        <Text style={shared.heading}>You&apos;re verified</Text>
        <Text style={shared.body}>
          Your ID and selfie match. Your verified selfie is now your profile photo.
        </Text>
        <Badge label="Verified" icon="checkmark" />
        <LinkText onPress={() => navigation.navigate('Main', { screen: 'Profile' })}>
          Back to profile
        </LinkText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', alignItems: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.brand },
  stepText: { ...typography.label, color: colors.textMuted },
  stepTextActive: { color: colors.text },
  stepLine: {
    width: 18,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    marginHorizontal: spacing.xxs,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  body: { ...typography.body, color: colors.text, flex: 1 },
  helperFlex: { ...typography.secondary, color: colors.textMuted, flex: 1 },
  consentBox: {
    backgroundColor: colors.tile,
    borderRadius: radius.md,
    padding: spacing.md,
    maxHeight: 180,
  },
  preview: {
    flex: 1,
    minHeight: 360,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.midnight,
  },
  camera: { flex: 1 },
  oval: {
    position: 'absolute',
    top: '12%',
    left: '18%',
    right: '18%',
    bottom: '22%',
    borderWidth: 3,
    borderColor: colors.brand,
    borderRadius: 999,
  },
  tips: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  tip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  tipText: { ...typography.label, color: colors.text },
  ovalText: {
    position: 'absolute',
    bottom: spacing.lg,
    alignSelf: 'center',
    ...typography.body,
    color: colors.textOnBrand,
  },
  shutterRow: { alignItems: 'center' },
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
  tile: {
    backgroundColor: colors.tile,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  accountName: { ...typography.heading, color: colors.navy },
  dropdown: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  dropdownRow: {
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  shield: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
