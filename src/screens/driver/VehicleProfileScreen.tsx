import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { driverApi, type VehiclePayload } from '../../api/driver';
import { toApiError } from '../../api/errors';
import { useAuth } from '../../auth/AuthContext';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { Checkbox, Chip, Stepper } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { appMode } from '../../state/mode';
import { colors, spacing, typography } from '../../theme';
import { ResultIcon, shared } from '../booking/shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;
const PLATE_COLOURS: VehiclePayload['plateColour'][] = ['Blue', 'Yellow', 'Red', 'Green', 'Other'];

/** Screen 21 · Your vehicle. Yellow/Red/Green plates are never blocked here. */
export function VehicleProfileScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [v, setV] = useState<VehiclePayload>({
    make: '',
    model: '',
    year: '',
    colour: '',
    licence: '',
    plate: '',
    seats: 4,
    plateColour: 'Blue',
    declaration: false,
  });
  const set = (patch: Partial<VehiclePayload>) => setV((s) => ({ ...s, ...patch }));
  const submit = useMutation({
    mutationFn: () => driverApi.createProfile(v),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
      navigation.replace('DriverReview');
    },
  });
  const complete = v.make && v.model && v.year && v.colour && v.licence && v.plate && v.declaration;

  return (
    <Screen
      testID="vehicle-profile"
      topBar={{ title: 'Your vehicle' }}
      footer={
        <Button
          title="Submit for review"
          onPress={() => submit.mutate()}
          disabled={!complete}
          loading={submit.isPending}
          testID="submit-vehicle"
        />
      }
    >
      <Text style={shared.subtitle}>Drive with SR2Go · step 1 of 1</Text>
      {submit.isError ? <Banner tone="error" message={toApiError(submit.error).message} /> : null}
      <TextField
        label="Make"
        placeholder="Toyota"
        value={v.make}
        onChangeText={(t) => set({ make: t })}
      />
      <TextField
        label="Model"
        placeholder="Sienna"
        value={v.model}
        onChangeText={(t) => set({ model: t })}
      />
      <TextField
        label="Year"
        placeholder="2012"
        value={v.year}
        onChangeText={(t) => set({ year: t })}
        keyboardType="numeric"
      />
      <TextField
        label="Colour"
        placeholder="Silver"
        value={v.colour}
        onChangeText={(t) => set({ colour: t })}
      />
      <TextField
        label="Driver's licence number"
        value={v.licence}
        onChangeText={(t) => set({ licence: t })}
        autoCapitalize="characters"
      />
      <TextField
        label="Plate number"
        placeholder="KJA-482LS"
        value={v.plate}
        onChangeText={(t) => set({ plate: t.toUpperCase() })}
        autoCapitalize="characters"
      />
      <View style={styles.row}>
        <Text style={styles.label}>Seats for passengers</Text>
        <Stepper
          value={v.seats}
          min={1}
          max={7}
          onChange={(n) => set({ seats: n })}
          testID="seats"
        />
      </View>
      <Text style={shared.overline}>Plate colour</Text>
      <View style={styles.chips}>
        {PLATE_COLOURS.map((c) => (
          <Chip
            key={c}
            label={c === 'Blue' ? 'Blue (private)' : c}
            tone="grey"
            selected={v.plateColour === c}
            onPress={() => set({ plateColour: c })}
          />
        ))}
      </View>
      <Checkbox
        checked={v.declaration}
        onChange={(d) => set({ declaration: d })}
        testID="declaration"
      >
        I declare this is a private vehicle that I own or am authorised to drive, and the details
        above are true.
      </Checkbox>
    </Screen>
  );
}

/** Screen 22 · Under review / Approved / Not approved, from GET /api/drivers/profile/me. */
export function DriverReviewScreen() {
  const navigation = useNavigation<Nav>();
  const { refreshProfile } = useAuth();
  const profile = useQuery({
    queryKey: ['driver-profile'],
    queryFn: driverApi.profile,
    refetchInterval: 30_000,
  });
  const goHome = () => navigation.navigate('Main', { screen: 'Home' });
  const p = profile.data ?? null;

  if (profile.isPending) {
    return (
      <Screen testID="driver-review" topBar={{ leading: 'close', onLeadingPress: goHome }}>
        <View style={shared.centered}>
          <Text style={shared.body}>Checking your vehicle…</Text>
        </View>
      </Screen>
    );
  }
  if (!p) {
    return (
      <Screen
        testID="driver-review"
        topBar={{ leading: 'close', onLeadingPress: goHome }}
        footer={
          <Button title="Add my vehicle" onPress={() => navigation.replace('VehicleProfile')} />
        }
      >
        <View style={shared.centered}>
          <ResultIcon icon="car-outline" />
          <Text style={shared.heading}>Drive with SR2Go</Text>
          <Text style={shared.body}>Add your vehicle to start posting rides.</Text>
        </View>
      </Screen>
    );
  }
  if (p.approval === 'approved') {
    return (
      <Screen
        testID="driver-review"
        topBar={{ leading: 'close', onLeadingPress: goHome }}
        footer={
          <Button
            title="Open driver mode"
            onPress={() => {
              void refreshProfile().catch(() => undefined);
              appMode.set('driver');
              navigation.navigate('DriverMain', { screen: 'MyRides' });
            }}
          />
        }
      >
        <View style={shared.centered}>
          <ResultIcon icon="checkmark" tone="blue" />
          <Text style={shared.heading}>Your vehicle is approved</Text>
          <Text style={shared.body}>You can post rides now.</Text>
          <Rows p={p} status="Approved" />
        </View>
      </Screen>
    );
  }
  if (p.approval === 'rejected') {
    return (
      <Screen
        testID="driver-review"
        topBar={{ leading: 'close', onLeadingPress: goHome }}
        footer={
          <>
            <Button
              title="Contact support"
              onPress={() =>
                Linking.openURL('mailto:support@shareride2go.com?subject=Vehicle review')
              }
            />
            <Button title="Back to home" variant="secondary" onPress={goHome} />
          </>
        }
      >
        <View style={shared.centered}>
          <ResultIcon icon="help-outline" />
          <Text style={shared.heading}>We couldn&apos;t approve your vehicle</Text>
          <Text style={shared.body}>
            Please contact our support team and we&apos;ll explain what&apos;s needed.
          </Text>
          <Text style={styles.email}>support@shareride2go.com</Text>
        </View>
      </Screen>
    );
  }
  return (
    <Screen
      testID="driver-review"
      topBar={{ leading: 'close', onLeadingPress: goHome }}
      footer={<Button title="Back to home" onPress={goHome} />}
    >
      <View style={shared.centered}>
        <ResultIcon icon="time-outline" tone="blue" />
        <Text style={shared.heading}>Your vehicle is under review</Text>
        <Text style={shared.body}>
          SR2Go is checking your details. We&apos;ll notify you as soon as you can start posting
          rides.
        </Text>
        <Rows p={p} status="Under review" />
      </View>
    </Screen>
  );
}

function Rows({
  p,
  status,
}: {
  p: { vehicle: string | null; plate: string | null };
  status: string;
}) {
  return (
    <View style={styles.card}>
      <Row k="Vehicle" v={p.vehicle ?? '—'} />
      <Row k="Plate" v={p.plate ?? '—'} />
      <View style={styles.kv}>
        <Text style={styles.k}>Status</Text>
        <Chip label={status} tone="blue" />
      </View>
    </View>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  label: { ...typography.body, color: colors.text, flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  email: { ...typography.body, color: colors.navy },
  card: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  k: { ...typography.body, color: colors.textMuted },
  v: { ...typography.body, color: colors.text },
});
