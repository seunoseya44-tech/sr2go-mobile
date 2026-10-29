import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { bookingsApi } from '../../api/bookings';
import { driverApi } from '../../api/driver';
import { toApiError } from '../../api/errors';
import { handoversApi, transfersApi, type Offer, type PersonLookup } from '../../api/social';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { Avatar, Card, Chip, ListRow } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { shortDate } from '../../utils/format';
import { ResultIcon, shared, tripLine } from '../booking/shared';
import { lagosDateTime } from '../../utils/time';

type Nav = NativeStackNavigationProp<AppStackParamList>;
const e164 = (phone: string) => `+234${phone.replace(/\D/g, '').replace(/^0/, '')}`;

/** Shared "look up by phone, confirm the person, send the offer" form. */
function OfferForm({
  title,
  intro,
  phoneLabel,
  lookup,
  send,
  onSent,
  cancelInstead,
}: {
  title: string;
  intro: string;
  phoneLabel: string;
  lookup: (phone: string) => Promise<PersonLookup>;
  send: (phone: string) => Promise<Offer | null>;
  onSent: (offer: Offer | null) => void;
  cancelInstead?: () => void;
}) {
  const [phone, setPhone] = useState('');
  const [person, setPerson] = useState<PersonLookup | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const find = useMutation({
    mutationFn: () => lookup(e164(phone)),
    onSuccess: (p) => {
      setPerson(p);
      setError(null);
    },
    onError: (e) => {
      setPerson(null);
      const err = toApiError(e);
      setError({ message: err.message, code: err.code });
    },
  });
  const offer = useMutation({
    mutationFn: () => send(e164(phone)),
    onSuccess: onSent,
    onError: (e) => {
      const err = toApiError(e);
      setError({ message: err.message, code: err.code });
    },
  });
  const tooLate = error?.code === 'too_late';

  return (
    <Screen
      testID="offer-form"
      topBar={{ title }}
      footer={
        tooLate && cancelInstead ? (
          <>
            <Button title={title} onPress={() => undefined} disabled />
            <Button title="Cancel ride instead" variant="secondary" onPress={cancelInstead} />
          </>
        ) : (
          <Button
            title="Send"
            onPress={() => offer.mutate()}
            disabled={!person}
            loading={offer.isPending}
          />
        )
      }
    >
      <Text style={styles.body}>{intro}</Text>
      {error ? (
        <Banner
          tone={tooLate ? 'warning' : 'error'}
          message={error.message}
          onDismiss={() => setError(null)}
        />
      ) : null}
      <TextField
        label={phoneLabel}
        prefix="+234"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={(t) => {
          setPhone(t.replace(/\D/g, '').slice(0, 11));
          setPerson(null);
        }}
        onBlur={() => phone.replace(/\D/g, '').length >= 10 && find.mutate()}
        accessory={find.isPending ? <ActivityIndicator color={colors.brand} /> : undefined}
      />
      {person ? (
        <Card tone="tile">
          <ListRow
            title={person.name ?? 'SR2Go user'}
            subtitle={[person.car ?? person.phoneMasked, 'Is this the right person?']
              .filter(Boolean)
              .join(' · ')}
            trailing={<Avatar name={person.name} size={36} verified={person.verified} />}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

/** B5 · Transfer my ticket (paid booking → another verified user by phone). */
export function TransferTicketScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'TransferTicket'>>();
  const queryClient = useQueryClient();
  const booking = useQuery({
    queryKey: ['bookings', params.bookingId],
    queryFn: () => bookingsApi.get(params.bookingId),
  });
  const [sent, setSent] = useState<Offer | null | undefined>(undefined);

  if (sent !== undefined) {
    return (
      <Screen
        testID="transfer-sent"
        topBar={{
          leading: 'close',
          onLeadingPress: () => navigation.navigate('Main', { screen: 'Trips' }),
        }}
        footer={
          <Button
            title="Back to my trips"
            onPress={() => navigation.navigate('Main', { screen: 'Trips' })}
          />
        }
      >
        <View style={shared.centered}>
          <ResultIcon icon="time-outline" tone="blue" />
          <Text style={shared.heading}>Waiting for {sent?.toName ?? 'them'} to accept</Text>
          <Text style={shared.body}>
            Your ticket stays yours until they accept. We&apos;ll tell you as soon as they answer.
          </Text>
          <Button
            title="See my transfers"
            variant="secondary"
            onPress={() => navigation.replace('TransfersInbox')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <OfferForm
      title="Transfer my ticket"
      intro={`${booking.data ? `${tripLine(booking.data)}. ` : ''}Give your seat to another verified SR2Go user. They get a new boarding pass; your codes stop working once they accept.`}
      phoneLabel="Their phone number"
      lookup={transfersApi.lookup}
      send={(phone) => transfersApi.offer(params.bookingId, phone)}
      onSent={(o) => {
        void queryClient.invalidateQueries({ queryKey: ['transfers'] });
        setSent(o);
      }}
    />
  );
}

/** B7 · Hand over my ride (driver → another approved driver, ≥ 24 h before). */
export function HandoverRideScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'HandoverRide'>>();
  const queryClient = useQueryClient();
  const ride = useQuery({
    queryKey: ['ride', params.rideId],
    queryFn: () => driverApi.ride(params.rideId),
  });
  const [sent, setSent] = useState<Offer | null | undefined>(undefined);
  const r = ride.data;

  if (sent !== undefined) {
    return (
      <Screen
        testID="handover-sent"
        topBar={{
          leading: 'close',
          onLeadingPress: () => navigation.navigate('DriverMain', { screen: 'MyRides' }),
        }}
        footer={
          <Button
            title="Back to my rides"
            onPress={() => navigation.navigate('DriverMain', { screen: 'MyRides' })}
          />
        }
      >
        <View style={shared.centered}>
          <ResultIcon icon="time-outline" tone="blue" />
          <Text style={shared.heading}>
            Waiting for {sent?.toName ?? 'the other driver'} to accept
          </Text>
          <Text style={shared.body}>
            The ride stays yours until they accept. Your passengers are told only once the handover
            is done.
          </Text>
          <Button
            title="See my handovers"
            variant="secondary"
            onPress={() => navigation.replace('HandoversInbox')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <OfferForm
      title="Hand over this ride"
      intro={`${r ? `${shortDate(r.departureDate)} · ${r.departureTime} · ${r.originCity} → ${r.destinationCity}. ` : ''}Give this ride to another approved SR2Go driver. Your passengers keep their bookings and are told who the new driver is.`}
      phoneLabel="The other driver's phone number"
      lookup={handoversApi.lookup}
      send={(phone) => handoversApi.offer(params.rideId, phone)}
      onSent={(o) => {
        void queryClient.invalidateQueries({ queryKey: ['handovers'] });
        setSent(o);
      }}
      cancelInstead={() => navigation.replace('RideRequests', { rideId: params.rideId })}
    />
  );
}

/** Incoming and outgoing offers with Accept / Decline / Cancel (transfers or handovers). */
function Inbox({ kind }: { kind: 'transfers' | 'handovers' }) {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const api = kind === 'transfers' ? transfersApi : handoversApi;
  const query = useQuery({ queryKey: [kind], queryFn: api.list, refetchInterval: 30_000 });
  const [note, setNote] = useState<string | null>(null);
  const act = useMutation({
    mutationFn: (v: { id: string; action: 'accept' | 'decline' | 'cancel' }) => api[v.action](v.id),
    onSuccess: (message, v) => {
      void queryClient.invalidateQueries({ queryKey: [kind] });
      void queryClient.invalidateQueries({
        queryKey: [kind === 'transfers' ? 'bookings' : 'my-rides'],
      });
      setNote(
        message ??
          (v.action === 'accept'
            ? kind === 'transfers'
              ? 'The seat is yours. Your boarding pass is in My trips.'
              : 'The ride is yours. Your passengers have been told.'
            : null),
      );
    },
    onError: (e) => setNote(toApiError(e).message),
  });
  const title = kind === 'transfers' ? 'Ticket transfers' : 'Ride handovers';
  const d = query.data;

  const card = (o: Offer, incoming: boolean) => (
    <View key={o.id} style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.semi}>
          {incoming
            ? `${o.fromName ?? 'Someone'} wants to give you ${kind === 'transfers' ? 'their seat' : 'their ride'}`
            : `Sent to ${o.toName ?? '—'}`}
        </Text>
        <Chip label={o.status} tone={o.status === 'pending' ? 'amber' : 'grey'} />
      </View>
      <Text style={shared.subtitle}>
        {[o.routeFrom, o.routeTo].filter(Boolean).join(' → ')}
        {o.departureTime
          ? ` · ${shortDate(o.departureTime)}${/T\d{2}:\d{2}/.test(o.departureTime) ? `, ${lagosDateTime(o.departureTime).time ?? ''}` : ''}`
          : ''}
      </Text>
      {kind === 'transfers' && incoming ? (
        <Text style={shared.subtitle}>
          If you accept, you get your own boarding pass and the seat is yours. Nothing to pay.
        </Text>
      ) : null}
      {kind === 'handovers' && incoming ? (
        <Text style={shared.subtitle}>
          If you accept, the passengers are told you are their new driver and get new boarding
          codes.
        </Text>
      ) : null}
      {o.status === 'pending' ? (
        incoming ? (
          <View style={styles.twoUp}>
            <Button
              title="Decline"
              variant="secondary"
              onPress={() => act.mutate({ id: o.id, action: 'decline' })}
              style={styles.flex}
            />
            <Button
              title={kind === 'transfers' ? 'Accept' : 'Accept this ride'}
              onPress={() => act.mutate({ id: o.id, action: 'accept' })}
              style={styles.flex}
            />
          </View>
        ) : (
          <Button
            title={kind === 'transfers' ? 'Cancel transfer' : 'Cancel handover'}
            variant="secondary"
            onPress={() => act.mutate({ id: o.id, action: 'cancel' })}
          />
        )
      ) : null}
    </View>
  );

  return (
    <Screen testID={`${kind}-inbox`} topBar={{ title }}>
      {note ? <Banner message={note} onDismiss={() => setNote(null)} /> : null}
      {query.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {query.isError ? <Banner tone="error" message={toApiError(query.error).message} /> : null}
      {d ? (
        <>
          <Text style={shared.overline}>Received ({d.incoming.length})</Text>
          {d.incoming.length === 0 ? (
            <Text style={shared.subtitle}>Nothing waiting for you.</Text>
          ) : (
            d.incoming.map((o) => card(o, true))
          )}
          <Text style={shared.overline}>Sent ({d.outgoing.length})</Text>
          {d.outgoing.length === 0 ? (
            <Text style={shared.subtitle}>You have not sent any.</Text>
          ) : (
            d.outgoing.map((o) => card(o, false))
          )}
        </>
      ) : null}
      <Button
        title={kind === 'transfers' ? 'Back to my trips' : 'Back to my rides'}
        variant="secondary"
        onPress={() =>
          kind === 'transfers'
            ? navigation.navigate('Main', { screen: 'Trips' })
            : navigation.navigate('DriverMain', { screen: 'MyRides' })
        }
      />
    </Screen>
  );
}

export function TransfersInboxScreen() {
  return <Inbox kind="transfers" />;
}
export function HandoversInboxScreen() {
  return <Inbox kind="handovers" />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { ...typography.body, color: colors.text },
  semi: { ...typography.bodySemibold, color: colors.text, flex: 1 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  twoUp: { flexDirection: 'row', gap: spacing.sm },
});
