import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { profileApi } from '../../api/account';
import { toApiError } from '../../api/errors';
import { useAuth } from '../../auth/AuthContext';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { Avatar, Checkbox, InfoBanner, LinkText } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { secureStorage } from '../../storage/secureStorage';
import { colors, radius, spacing, typography } from '../../theme';
import { ResultIcon, shared } from '../booking/shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

function localPhone(e164: string | null): string {
  if (!e164) return '';
  return e164.replace(/^\+?234/, '').replace(/^0/, '');
}

/** E6 · Personal details. Name locked once verified; a new phone goes through OTP again. */
export function PersonalDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(localPhone(user?.phone ?? null));
  const nameLocked = user?.isVerified === true;
  const phoneChanged = phone !== localPhone(user?.phone ?? null);
  const changed = (!nameLocked && name.trim() !== (user?.fullName ?? '')) || phoneChanged;

  const save = useMutation({
    mutationFn: () =>
      profileApi.update({
        ...(nameLocked ? {} : { fullName: name.trim() }),
        ...(phoneChanged ? { phone: `+234${phone.replace(/\D/g, '')}` } : {}),
      }),
    onSuccess: async () => {
      await refreshProfile().catch(() => undefined);
      navigation.goBack();
    },
  });

  return (
    <Screen
      testID="personal-details"
      topBar={{ title: 'Personal details' }}
      footer={
        <Button
          title="Save changes"
          onPress={() => save.mutate()}
          disabled={!changed}
          loading={save.isPending}
        />
      }
    >
      <View style={styles.center}>
        <Avatar
          name={user?.fullName ?? user?.email ?? null}
          size={72}
          verified={user?.isVerified === true}
        />
        <Text style={shared.small}>
          Your photo is your verified selfie and can&apos;t be changed here.
        </Text>
      </View>
      {save.isError ? <Banner tone="error" message={toApiError(save.error).message} /> : null}
      <TextField
        label="Full name"
        value={name}
        onChangeText={setName}
        editable={!nameLocked}
        helper={
          nameLocked
            ? 'Your name matches your verified ID. Contact support to change it.'
            : undefined
        }
      />
      <TextField
        label="Email"
        value={user?.email ?? ''}
        editable={false}
        helper="Email can't be changed. Contact support if you need to."
      />
      <TextField
        label="Phone number"
        prefix="+234"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
        helper="If you change your number we'll text a code to confirm it."
      />
      {phoneChanged ? (
        <InfoBanner>You&apos;ll confirm the new number with a code on the next screen.</InfoBanner>
      ) : null}
    </Screen>
  );
}

/** Screen 46 B · Change password. */
export function ChangePasswordScreen() {
  const navigation = useNavigation<Nav>();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const strong = next.length >= 8 && /[^A-Za-z0-9]/.test(next);
  const change = useMutation({
    mutationFn: () => profileApi.changePassword(current, next),
    onSuccess: () => setDone(true),
  });

  if (done) {
    return (
      <Screen
        testID="change-password"
        topBar={null}
        footer={<Button title="Back to profile" onPress={() => navigation.goBack()} />}
      >
        <View style={shared.centered}>
          <ResultIcon icon="checkmark" tone="blue" />
          <Text style={shared.heading}>Password updated</Text>
        </View>
      </Screen>
    );
  }
  return (
    <Screen
      testID="change-password"
      topBar={{ title: 'Change password' }}
      footer={
        <Button
          title="Save new password"
          onPress={() => change.mutate()}
          disabled={!current || !strong || next !== confirm}
          loading={change.isPending}
        />
      }
    >
      {change.isError ? <Banner tone="error" message={toApiError(change.error).message} /> : null}
      <TextField
        label="Current password"
        secureTextEntry
        value={current}
        onChangeText={setCurrent}
      />
      <LinkText onPress={() => navigation.navigate('ForgotPassword')}>
        Forgot your current password?
      </LinkText>
      <TextField
        label="New password"
        secureTextEntry
        value={next}
        onChangeText={setNext}
        helper="At least 8 characters, including one symbol"
        error={next && !strong ? 'At least 8 characters, including one symbol' : undefined}
      />
      <TextField
        label="Confirm new password"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        error={confirm && confirm !== next ? 'Passwords do not match' : undefined}
      />
    </Screen>
  );
}

export const EMERGENCY_KEY = 'sr2go.emergency.contact';

export async function readEmergencyContact(): Promise<{ name: string; phone: string } | null> {
  const raw = await secureStorage.get(EMERGENCY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { name: string; phone: string };
  } catch {
    return null;
  }
}

/** E7 · Emergency contact. Saved on this phone only; used by SOS. */
export function EmergencyContactScreen() {
  const navigation = useNavigation<Nav>();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [exists, setExists] = useState(false);
  useEffect(() => {
    void readEmergencyContact().then((c) => {
      if (c) {
        setName(c.name);
        setPhone(localPhone(c.phone));
        setExists(true);
      }
    });
  }, []);
  const save = async () => {
    await secureStorage.set(
      EMERGENCY_KEY,
      JSON.stringify({ name: name.trim(), phone: `+234${phone.replace(/\D/g, '')}` }),
    );
    navigation.goBack();
  };
  const remove = async () => {
    await secureStorage.remove(EMERGENCY_KEY);
    navigation.goBack();
  };
  return (
    <Screen
      testID="emergency-contact"
      topBar={{ title: 'Emergency contact' }}
      footer={
        <>
          <Button
            title="Save contact"
            onPress={() => void save()}
            disabled={!name.trim() || phone.replace(/\D/g, '').length < 10}
          />
          {exists ? (
            <LinkText onPress={() => void remove()} style={styles.removeLink}>
              Remove contact
            </LinkText>
          ) : null}
        </>
      }
    >
      <Text style={shared.heading}>Who should we alert?</Text>
      <Text style={shared.subtitle}>
        If you press SOS during a trip, SR2Go texts this person your location. It&apos;s saved on
        this phone only.
      </Text>
      <TextField label="Name" placeholder="Mum" value={name} onChangeText={setName} />
      <TextField
        label="Phone number"
        prefix="+234"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
      />
      <View style={styles.tile}>
        <Ionicons name="shield-outline" size={20} color={colors.navy} />
        <Text style={styles.tileText}>
          Tell them in advance so the message doesn&apos;t surprise them.
        </Text>
      </View>
    </Screen>
  );
}

/** E4 / E5 · Delete account. */
export function DeleteAccountScreen() {
  const navigation = useNavigation<Nav>();
  const { signOut } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [password, setPassword] = useState('');
  const [blocked, setBlocked] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const del = useMutation({
    mutationFn: () => profileApi.deleteAccount(password),
    onSuccess: () => setDone(true),
    onError: (e) => {
      const err = toApiError(e);
      if (err.status === 401 || err.code === 'wrong_password') setPasswordError(err.message);
      else setBlocked(err.message);
    },
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (done) {
    return (
      <Screen
        testID="delete-account"
        topBar={null}
        footer={<Button title="Back to start" onPress={() => void signOut()} />}
      >
        <View style={shared.centered}>
          <ResultIcon icon="checkmark" />
          <Text style={shared.heading}>Your account has been deleted</Text>
          <Text style={shared.body}>
            Thank you for travelling with SR2Go. You can create a new account any time.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      testID="delete-account"
      topBar={{ title: 'Delete account' }}
      footer={
        blocked ? (
          <Button title="Back to profile" onPress={() => navigation.goBack()} />
        ) : (
          <>
            <Button
              title="Delete my account"
              variant="danger"
              onPress={() => del.mutate()}
              disabled={!agreed || password.length < 6}
              loading={del.isPending}
            />
            <Button
              title="Keep my account"
              variant="secondary"
              onPress={() => navigation.goBack()}
            />
          </>
        )
      }
    >
      <View style={styles.center}>
        <ResultIcon icon="person-remove-outline" />
        <Text style={shared.heading}>Delete your SR2Go account?</Text>
        <Text style={shared.body}>
          This permanently removes your account. It can&apos;t be undone.
        </Text>
      </View>
      <Text style={shared.overline}>What is deleted</Text>
      {[
        ['person-outline', 'Your profile, phone number and email'],
        ['id-card-outline', 'Your verified selfie and ID details'],
        ['card-outline', 'Your bank account details'],
        ['car-outline', 'Your trips and bookings history'],
        ['wallet-outline', 'Your ride credits (they are not refunded)'],
      ].map(([icon, text]) => (
        <View key={text} style={styles.row}>
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={colors.navy} />
          <Text style={styles.body}>{text}</Text>
        </View>
      ))}
      {blocked ? (
        <InfoBanner tone="amber">{blocked}</InfoBanner>
      ) : (
        <>
          <TextField
            label="Your password"
            secureTextEntry
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setPasswordError(null);
            }}
            error={passwordError ?? undefined}
          />
          <Checkbox checked={agreed} onChange={setAgreed}>
            I understand my account and data will be deleted and this can&apos;t be undone.
          </Checkbox>
        </>
      )}
      <LinkText
        onPress={() => Linking.openURL('mailto:support@shareride2go.com?subject=Delete my account')}
      >
        Email support instead
      </LinkText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  body: { ...typography.body, color: colors.text, flex: 1 },
  tile: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.tile,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  tileText: { ...typography.body, color: colors.navy, flex: 1 },
  removeLink: { alignSelf: 'center' },
});
