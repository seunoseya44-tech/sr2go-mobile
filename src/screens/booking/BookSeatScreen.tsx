import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { bookingsApi } from '../../api/bookings';
import { toApiError } from '../../api/errors';
import { ridesApi } from '../../api/rides';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { Checkbox, InfoBanner, Stepper } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';
import { shortDate } from '../../utils/format';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * Screen 11 · Book your seat. One adult per booking plus children under 18
 * (13 Oct). No price here: the passenger pays only after the driver accepts.
 */
export function BookSeatScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'BookSeat'>>();
  const queryClient = useQueryClient();
  const ride = useQuery({
    queryKey: ['ride', params.rideId],
    queryFn: () => ridesApi.get(params.rideId),
  });

  const [children, setChildren] = useState(0);
  const [frontSeat, setFrontSeat] = useState(false);
  const [note, setNote] = useState('');
  const [address, setAddress] = useState('');
  const [luggageKg, setLuggageKg] = useState('');
  const [luggageDesc, setLuggageDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [kycRequired, setKycRequired] = useState(false);

  const r = ride.data;
  const seatsLeft = r?.seatsLeft ?? 7;
  const maxChildren = Math.max(0, Math.min(6, seatsLeft - 1));
  const maxKg = r?.maxLuggageKg ?? null;
  const kg = luggageKg.trim() === '' ? null : Number(luggageKg);
  const luggageError =
    kg != null && (!Number.isFinite(kg) || kg < 0)
      ? 'Enter a number'
      : kg != null && maxKg != null && kg > maxKg
        ? `This driver allows up to ${maxKg} kg`
        : undefined;

  const create = useMutation({
    mutationFn: () =>
      bookingsApi.create({
        rideId: params.rideId,
        children,
        frontSeatPreferred: frontSeat,
        pickupNote: note.trim(),
        pickupAddress: address.trim(),
        luggageKg: kg,
        luggageDescription: luggageDesc.trim(),
      }),
    onSuccess: (booking) => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigation.replace(booking.status === 'accepted' ? 'Payment' : 'BookingStatus', {
        bookingId: booking.id,
      });
    },
    onError: (e) => {
      const err = toApiError(e);
      if (err.code === 'kyc_required') {
        setKycRequired(true);
      }
      setError(err.message);
      // "Sorry, those seats were just taken" → back to results after the message.
      if (err.status === 409) setTimeout(() => navigation.goBack(), 2500);
    },
  });

  const instant = r?.autoApprove === true;
  const title = instant ? 'Continue to payment' : 'Request to book';

  return (
    <Screen
      testID="book-seat"
      topBar={{ title: 'Book your seat' }}
      footer={
        <Button
          title={title}
          onPress={() => {
            setError(null);
            create.mutate();
          }}
          loading={create.isPending}
          loadingTitle="Sending…"
          disabled={!r || !!luggageError}
          testID="submit-booking"
        />
      }
    >
      {r ? (
        <Text style={styles.subtitle}>
          {r.originCity} → {r.destinationCity} · {shortDate(r.departureDate)}, {r.departureTime}
        </Text>
      ) : null}

      {error ? <Banner tone={kycRequired ? 'info' : 'error'} message={error} /> : null}
      {kycRequired ? (
        <Button
          title="Verify my identity"
          variant="secondary"
          onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
        />
      ) : null}

      {!instant ? (
        <InfoBanner>You won&apos;t pay until the driver accepts your request.</InfoBanner>
      ) : null}

      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>You</Text>
          <Text style={styles.helper}>1 seat</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>Children travelling with you (under 18)</Text>
          <Text style={styles.helper}>
            {seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left
          </Text>
        </View>
        <Stepper
          value={children}
          min={0}
          max={maxChildren}
          onChange={setChildren}
          testID="children"
        />
      </View>
      <Text style={styles.helper}>Adults travelling with you book their own seat.</Text>

      <Checkbox checked={frontSeat} onChange={setFrontSeat} testID="front-seat">
        Front seat preferred (the driver will try, not guaranteed)
      </Checkbox>

      <TextField
        label="Note for the driver"
        placeholder="e.g. I'll be at the entrance, wearing a red cap"
        value={note}
        onChangeText={setNote}
        multiline
      />
      <TextField
        label="Pickup address (optional)"
        placeholder="Where you're coming from"
        value={address}
        onChangeText={setAddress}
      />
      <View style={styles.twoUp}>
        <View style={styles.flex}>
          <TextField
            label="Luggage (kg)"
            value={luggageKg}
            onChangeText={setLuggageKg}
            keyboardType="numeric"
            helper={maxKg != null ? `max ${maxKg}` : undefined}
            error={luggageError}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label="Description"
            placeholder="1 travel bag"
            value={luggageDesc}
            onChangeText={setLuggageDesc}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  subtitle: { ...typography.secondary, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { ...typography.body, color: colors.text },
  helper: { ...typography.secondary, color: colors.textMuted },
  twoUp: { flexDirection: 'row', gap: spacing.md },
});
