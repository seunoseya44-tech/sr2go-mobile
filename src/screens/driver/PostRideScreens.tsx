import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { driverApi, type MeetingPoint, type PriceCheck, type RouteInput } from '../../api/driver';
import { toApiError } from '../../api/errors';
import type { Preference } from '../../api/types';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { Checkbox, Chip, InfoBanner, Segmented, Stepper } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { postRide, usePostRide } from '../../state/postRide';
import { colors, radius, spacing, TAP, typography } from '../../theme';
import { chipDate, isoDate, naira } from '../../utils/format';
import { shared } from '../booking/shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

function routeOf(form: ReturnType<typeof usePostRide>): RouteInput | null {
  if (!form.origin || !form.destination) return null;
  return {
    originLat: form.origin.lat,
    originLng: form.origin.lng,
    originCity: form.origin.city,
    destLat: form.destination.lat,
    destLng: form.destination.lng,
    destCity: form.destination.city,
  };
}

function Steps({ active }: { active: 0 | 1 | 2 }) {
  return (
    <View style={styles.steps}>
      {['Route', 'Price', 'Details'].map((s, i) => (
        <View key={s} style={styles.step}>
          <View style={[styles.stepDot, i <= active && styles.stepDotActive]} />
          <Text style={[styles.stepText, i === active && styles.stepTextActive]}>{s}</Text>
          {i < 2 ? <View style={styles.stepLine} /> : null}
        </View>
      ))}
    </View>
  );
}

/** Screen 23 · Route, car, seats and meeting point. */
export function PostRideRouteScreen() {
  const navigation = useNavigation<Nav>();
  const form = usePostRide();
  const route = routeOf(form);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const points = useQuery({
    queryKey: ['meeting-points', route],
    queryFn: () => driverApi.meetingPoints(route!),
    enabled: !!route,
  });

  useEffect(() => {
    const list = points.data;
    if (list && list.length > 0 && !form.meetingPoint && !form.ownMeetingPoint) {
      postRide.set({ meetingPoint: list[0] ?? null });
    }
  }, [points.data, form.meetingPoint, form.ownMeetingPoint]);

  const canNext =
    !!route && !!form.car.trim() && (!!form.meetingPoint || !!form.ownMeetingPoint.trim());
  const dateValue = new Date(`${form.date}T${form.time}:00`);

  return (
    <Screen
      testID="post-ride-route"
      topBar={{ title: 'Post a ride', leading: 'close', onLeadingPress: () => navigation.goBack() }}
      footer={
        <Button
          title="Next: price"
          onPress={() => navigation.navigate('PostRidePrice')}
          disabled={!canNext}
        />
      }
    >
      <Steps active={0} />
      <PlaceRow
        label="From"
        value={form.origin?.name ?? null}
        onPress={() =>
          navigation.navigate('PlacePicker', {
            field: 'origin',
            current: form.origin,
            target: 'post',
          })
        }
      />
      <PlaceRow
        label="To"
        value={form.destination?.name ?? null}
        onPress={() =>
          navigation.navigate('PlacePicker', {
            field: 'destination',
            current: form.destination,
            target: 'post',
          })
        }
      />

      <View style={styles.chips}>
        <Chip
          label={chipDate(form.date)}
          icon="calendar-outline"
          tone="grey"
          onPress={() => setPicker('date')}
        />
        <Chip label={form.time} icon="time-outline" tone="grey" onPress={() => setPicker('time')} />
      </View>
      {picker ? (
        <DateTimePicker
          value={dateValue}
          mode={picker}
          minimumDate={new Date()}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_event: unknown, d?: Date) => {
            setPicker(null);
            if (!d) return;
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            postRide.set(picker === 'date' ? { date: isoDate(d) } : { time: `${hh}:${mm}` });
          }}
        />
      ) : null}

      <View style={styles.row}>
        <Text style={styles.label}>Seats for passengers</Text>
        <Stepper
          value={form.seats}
          min={1}
          max={7}
          onChange={(seats) => postRide.set({ seats })}
          testID="post-seats"
        />
      </View>

      <TextField
        label="Your car"
        placeholder="e.g. Toyota Sienna, Toyota Corolla, shuttle bus"
        value={form.car}
        onChangeText={(car) => postRide.set({ car })}
      />

      <Text style={styles.h}>Meeting point</Text>
      <Text style={shared.subtitle}>Places near where you&apos;re leaving from.</Text>
      {!route ? (
        <Text style={shared.subtitle}>Choose From and To first.</Text>
      ) : points.isError ? (
        <Banner tone="error" message={toApiError(points.error).message} />
      ) : (
        (points.data ?? []).map((m) => (
          <MeetingCard
            key={m.name}
            m={m}
            selected={form.meetingPoint?.name === m.name}
            onPress={() => postRide.set({ meetingPoint: m, ownMeetingPoint: '' })}
          />
        ))
      )}
      <View
        style={[styles.card, !form.meetingPoint && !!form.ownMeetingPoint && styles.cardSelected]}
      >
        <View style={styles.rowStart}>
          <Ionicons name="pencil-outline" size={18} color={colors.navy} />
          <Text style={styles.semi}>Type my own meeting point</Text>
        </View>
        <TextField
          label=""
          placeholder="e.g. Opposite Mobil filling station, Ikeja Along"
          value={form.ownMeetingPoint}
          onChangeText={(ownMeetingPoint) =>
            postRide.set({
              ownMeetingPoint,
              meetingPoint: ownMeetingPoint ? null : form.meetingPoint,
            })
          }
        />
      </View>
    </Screen>
  );
}

function PlaceRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.placeRow} accessibilityRole="button">
      <Ionicons name="location-outline" size={20} color={colors.brand} />
      <View style={styles.flex}>
        <Text style={styles.placeLabel}>{label}</Text>
        <Text style={[styles.placeValue, !value && styles.placeholder]}>
          {value ?? 'Choose a place'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
    </Pressable>
  );
}

function MeetingCard({
  m,
  selected,
  onPress,
}: {
  m: MeetingPoint;
  selected: boolean;
  onPress: () => void;
}) {
  const dist =
    m.distanceM != null
      ? m.distanceM >= 1000
        ? `${(m.distanceM / 1000).toFixed(1)} km away`
        : `${Math.round(m.distanceM)} m away`
      : null;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={styles.rowStart}>
        <View style={styles.flex}>
          <Text style={styles.semi}>{m.name}</Text>
          {m.type ? <Text style={styles.tag}>{m.type}</Text> : null}
          <Text style={shared.subtitle}>{[m.address, dist].filter(Boolean).join(' · ')}</Text>
        </View>
        {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.brand} /> : null}
      </View>
    </Pressable>
  );
}

/** Screen 24 · Price with the backend's warning level and three lines. */
export function PostRidePriceScreen() {
  const navigation = useNavigation<Nav>();
  const form = usePostRide();
  const route = routeOf(form)!;
  const suggestion = useQuery({
    queryKey: ['suggest-price', route],
    queryFn: () => driverApi.suggestPrice(route),
  });
  const [check, setCheck] = useState<PriceCheck | null>(null);
  const checkPrice = useMutation({
    mutationFn: (p: string) => driverApi.checkPrice(route, p),
    onSuccess: setCheck,
  });
  const [own, setOwn] = useState(!!form.driverPrice);

  useEffect(() => {
    const p = form.driverPrice.trim();
    if (!p || !Number.isFinite(Number(p))) return;
    const t = setTimeout(() => checkPrice.mutate(p), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.driverPrice]);

  const priceValid = !!form.driverPrice.trim() && Number.isFinite(Number(form.driverPrice));
  const shown = priceValid ? check : null;
  const needsAck = !!shown?.requiresAck;
  const canNext =
    !!form.driverPrice && Number(form.driverPrice) > 0 && (!needsAck || form.priceAcknowledged);
  const tone = shown?.level === 'BELOW_FLOOR' || shown?.level === 'ABOVE_MARKET' ? 'red' : 'amber';

  return (
    <Screen
      testID="post-ride-price"
      topBar={{ title: 'Post a ride' }}
      footer={
        <Button
          title="Next: details"
          onPress={() => navigation.navigate('PostRideDetails')}
          disabled={!canNext}
        />
      }
    >
      <Steps active={1} />
      <View style={styles.tile}>
        <Text style={shared.overline}>SR2Go suggested price</Text>
        <Text style={styles.price}>
          {suggestion.data?.suggested
            ? `${naira(suggestion.data.suggested)} per seat`
            : suggestion.isPending
              ? '…'
              : 'No suggestion for this route'}
        </Text>
        <Text style={shared.subtitle}>
          {form.origin?.name} → {form.destination?.name}
        </Text>
      </View>
      <View style={styles.twoUp}>
        <Button
          title="Use this price"
          onPress={() => {
            postRide.set({ driverPrice: suggestion.data?.suggested ?? '' });
            setOwn(false);
          }}
          disabled={!suggestion.data?.suggested}
          style={styles.flex}
        />
        <Button
          title="Set my own price"
          variant="secondary"
          onPress={() => setOwn(true)}
          style={styles.flex}
        />
      </View>
      {own || form.driverPrice ? (
        <TextField
          label="Your price per seat (what you take home)"
          prefix="₦"
          keyboardType="numeric"
          value={form.driverPrice}
          onChangeText={(driverPrice) =>
            postRide.set({
              driverPrice: driverPrice.replace(/[^\d.]/g, ''),
              priceAcknowledged: false,
            })
          }
        />
      ) : null}
      {shown?.lines.map((l) => (
        <Text key={l} style={styles.line}>
          {l}
        </Text>
      ))}
      {shown && shown.level === 'GOOD' ? (
        <Text style={styles.good}>In line with this route</Text>
      ) : null}
      {shown?.driverMessage && shown.level !== 'GOOD' && shown.level !== 'UNKNOWN' ? (
        <InfoBanner tone={tone}>{shown.driverMessage}</InfoBanner>
      ) : null}
      {needsAck ? (
        <Checkbox
          checked={form.priceAcknowledged}
          onChange={(priceAcknowledged) => postRide.set({ priceAcknowledged })}
        >
          {shown?.responsibilityNotice ??
            'I understand this price is my own choice and my responsibility.'}
        </Checkbox>
      ) : null}
    </Screen>
  );
}

const PREF: { value: NonNullable<Preference>; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'ask', label: 'Ask' },
];

/** Screen 25 · Details, then POST /api/rides/. */
export function PostRideDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const form = usePostRide();
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const post = useMutation({
    mutationFn: () =>
      driverApi.postRide({
        route: routeOf(form)!,
        originName: form.origin!.name,
        destName: form.destination!.name,
        date: form.date,
        time: form.time,
        seats: form.seats,
        car: form.car.trim(),
        meetingPoint: form.meetingPoint
          ? {
              name: form.meetingPoint.name,
              address: form.meetingPoint.address,
              lat: form.meetingPoint.lat,
              lng: form.meetingPoint.lng,
            }
          : { name: form.ownMeetingPoint.trim(), address: null, lat: null, lng: null },
        driverPrice: form.driverPrice,
        priceAcknowledged: form.priceAcknowledged,
        autoApprove: form.autoApprove,
        isAc: form.isAc,
        prefMusic: form.prefMusic,
        prefPets: form.prefPets,
        prefChat: form.prefChat,
        prefSmoking: form.prefSmoking,
        driverSmokes: form.driverSmokes,
        maxLuggageKg: form.maxLuggageKg.trim() ? Number(form.maxLuggageKg) : null,
        luggageNote: form.luggageNote.trim(),
        notes: form.notes.trim(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-rides'] });
      postRide.reset();
      navigation.navigate('DriverMain', { screen: 'MyRides' });
    },
    onError: (e) => {
      const err = toApiError(e);
      setError(err.message);
      setErrorCode(err.code ?? null);
    },
  });

  return (
    <Screen
      testID="post-ride-details"
      topBar={{ title: 'Post a ride' }}
      footer={
        <Button
          title="Post ride"
          onPress={() => {
            setError(null);
            post.mutate();
          }}
          loading={post.isPending}
          loadingTitle="Posting…"
        />
      }
    >
      <Steps active={2} />
      {error ? <Banner tone="error" message={error} /> : null}
      {errorCode === 'driver_profile_required' ? (
        <Button
          title="Register my car"
          variant="secondary"
          onPress={() => navigation.navigate('VehicleProfile')}
        />
      ) : null}
      {errorCode === 'driver_not_approved' ? (
        <Button
          title="Check my review"
          variant="secondary"
          onPress={() => navigation.navigate('DriverReview')}
        />
      ) : null}

      <Toggle
        label="Instant booking"
        helper="Passengers book without waiting for you to accept"
        value={form.autoApprove}
        onChange={(autoApprove) => postRide.set({ autoApprove })}
      />
      <Toggle
        label="Air conditioning works"
        helper="Passengers will expect AC for the whole trip"
        value={form.isAc}
        onChange={(isAc) => postRide.set({ isAc })}
      />
      <PrefRow
        label="Music"
        value={form.prefMusic}
        onChange={(prefMusic) => postRide.set({ prefMusic })}
      />
      <PrefRow
        label="Pets"
        value={form.prefPets}
        onChange={(prefPets) => postRide.set({ prefPets })}
      />
      <PrefRow
        label="Chatting"
        value={form.prefChat}
        onChange={(prefChat) => postRide.set({ prefChat })}
      />
      <PrefRow
        label="Passengers smoking"
        value={form.prefSmoking}
        onChange={(prefSmoking) => postRide.set({ prefSmoking })}
      />
      <Toggle
        label="I smoke while driving"
        helper="Passengers will see a clear warning"
        value={form.driverSmokes}
        onChange={(driverSmokes) => postRide.set({ driverSmokes })}
      />
      <TextField
        label="Luggage limit (kg)"
        keyboardType="numeric"
        value={form.maxLuggageKg}
        onChangeText={(maxLuggageKg) =>
          postRide.set({ maxLuggageKg: maxLuggageKg.replace(/[^\d]/g, '') })
        }
      />
      <TextField
        label="Luggage note"
        placeholder="One medium bag"
        value={form.luggageNote}
        onChangeText={(luggageNote) => postRide.set({ luggageNote })}
      />
      <TextField
        label="Note for passengers"
        placeholder="I leave on time. Please arrive 10 minutes early."
        value={form.notes}
        onChangeText={(notes) => postRide.set({ notes })}
        multiline
      />
    </Screen>
  );
}

function Toggle({
  label,
  helper,
  value,
  onChange,
}: {
  label: string;
  helper: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={styles.label}>{label}</Text>
        <Text style={shared.subtitle}>{helper}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.brand, false: colors.border }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

function PrefRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Preference;
  onChange: (v: Preference) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, styles.flex]}>{label}</Text>
      <Segmented options={PREF} value={value ?? 'ask'} onChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  steps: { flexDirection: 'row', alignItems: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  stepDotActive: { backgroundColor: colors.brand },
  stepText: { ...typography.label, color: colors.textMuted },
  stepTextActive: { color: colors.text },
  stepLine: {
    width: 28,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TAP,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.xs,
  },
  placeLabel: { ...typography.label, color: colors.textMuted },
  placeValue: { ...typography.body, color: colors.text },
  placeholder: { color: colors.textSubtle },
  chips: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TAP },
  rowStart: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  label: { ...typography.body, color: colors.text },
  h: { ...typography.heading, color: colors.text },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  cardSelected: { borderColor: colors.brand, borderWidth: 2 },
  semi: { ...typography.bodySemibold, color: colors.text },
  tag: { ...typography.label, color: colors.textMuted },
  tile: {
    backgroundColor: colors.tile,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  price: { ...typography.price, color: colors.navy },
  twoUp: { flexDirection: 'row', gap: spacing.sm },
  line: { ...typography.body, color: colors.navy },
  good: { ...typography.secondary, color: colors.navy },
});
