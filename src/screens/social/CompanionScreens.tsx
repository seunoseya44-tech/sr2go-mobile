import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { bookingsApi } from '../../api/bookings';
import { toApiError } from '../../api/errors';
import { companionsApi, type CompanionInvite, type PersonLookup } from '../../api/social';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { Avatar, Card, Chip, InfoBanner, ListRow } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { shortDate } from '../../utils/format';
import { shared, tripLine } from '../booking/shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;
const e164 = (phone: string) => `+234${phone.replace(/\D/g, '').replace(/^0/, '')}`;

/** B1 · Travelling with: add a friend by phone; they accept on their phone. The booker pays. */
export function TravellingWithScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'TravellingWith'>>();
  const queryClient = useQueryClient();
  const booking = useQuery({
    queryKey: ['bookings', params.bookingId],
    queryFn: () => bookingsApi.get(params.bookingId),
  });
  const mine = useQuery({
    queryKey: ['companions'],
    queryFn: companionsApi.list,
    refetchInterval: 30_000,
  });
  const [phone, setPhone] = useState('');
  const [person, setPerson] = useState<PersonLookup | null>(null);
  const [note, setNote] = useState<{ tone: 'error' | 'info'; message: string } | null>(null);

  const lookup = useMutation({
    mutationFn: () => companionsApi.lookup(e164(phone)),
    onSuccess: (p) => {
      setPerson(p);
      setNote(null);
    },
    onError: (e) => {
      setPerson(null);
      setNote({ tone: 'error', message: toApiError(e).message });
    },
  });
  const invite = useMutation({
    mutationFn: () => companionsApi.invite(params.bookingId, e164(phone)),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['companions'] });
      setNote({ tone: 'info', message: r.message ?? `Invitation sent to ${r.toName ?? 'them'}.` });
      setPerson(null);
      setPhone('');
    },
    onError: (e) => setNote({ tone: 'error', message: toApiError(e).message }),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => companionsApi.cancel(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['companions'] }),
    onError: (e) => setNote({ tone: 'error', message: toApiError(e).message }),
  });

  const onThis = (mine.data?.outgoing ?? []).filter((c) => c.bookingId === params.bookingId);
  const b = booking.data;

  return (
    <Screen
      testID="travelling-with"
      topBar={{ title: 'Travelling with' }}
      footer={<Button title="Done" variant="secondary" onPress={() => navigation.goBack()} />}
    >
      {b ? <Text style={shared.subtitle}>{tripLine(b)}</Text> : null}
      <Text style={styles.body}>
        Add a friend by the phone number on their SR2Go account. They accept on their own phone and
        we add them to your booking. You pay for their seat once they accept.
      </Text>
      {note ? (
        <Banner tone={note.tone} message={note.message} onDismiss={() => setNote(null)} />
      ) : null}
      <TextField
        label="Phone number"
        prefix="+234"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={(t) => {
          setPhone(t.replace(/\D/g, '').slice(0, 11));
          setPerson(null);
        }}
        onBlur={() => phone.replace(/\D/g, '').length >= 10 && lookup.mutate()}
        accessory={lookup.isPending ? <ActivityIndicator color={colors.brand} /> : undefined}
      />
      {person ? (
        <Card tone="tile">
          <ListRow
            title={person.name ?? 'SR2Go user'}
            subtitle={`${person.phoneMasked ?? ''} · Is this the right person?`}
            trailing={
              <Button title="Invite" onPress={() => invite.mutate()} loading={invite.isPending} />
            }
          />
        </Card>
      ) : null}
      <Text style={shared.overline}>On this booking</Text>
      <View style={styles.row}>
        <Avatar name={b?.raw.passenger_name ? String(b.raw.passenger_name) : 'You'} size={36} />
        <Text style={[styles.semi, styles.flex]}>You</Text>
        <Chip label="Booked" tone="blue" />
      </View>
      {onThis.map((c) => (
        <View key={c.id} style={styles.row}>
          <Avatar name={c.toName} size={36} />
          <View style={styles.flex}>
            <Text style={styles.semi}>{c.toName ?? 'Friend'}</Text>
            <Text style={shared.subtitle}>
              {c.status === 'pending' ? `Waiting for ${c.toName ?? 'them'} to accept` : c.status}
            </Text>
          </View>
          <Chip
            label={
              c.status === 'accepted' ? 'Accepted' : c.status === 'pending' ? 'Invited' : c.status
            }
            tone={c.status === 'accepted' ? 'blue' : 'grey'}
          />
          {c.status === 'pending' ? (
            <Button title="Cancel" variant="ghost" onPress={() => cancel.mutate(c.id)} />
          ) : null}
        </View>
      ))}
      {mine.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      <InfoBanner>
        Your Pay button covers your seat and every accepted friend. Each friend travels on their own
        verified SR2Go account.
      </InfoBanner>
    </Screen>
  );
}

/** B2 · Trip invitations (the friend's side): consent text from the backend, accept with luggage, decline. */
export function CompanionInvitesScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const mine = useQuery({
    queryKey: ['companions'],
    queryFn: companionsApi.list,
    refetchInterval: 30_000,
  });
  const [luggage, setLuggage] = useState<Record<string, { kg: string; desc: string }>>({});
  const [note, setNote] = useState<{ tone: 'error' | 'info'; message: string } | null>(null);
  const act = useMutation({
    mutationFn: (v: { id: string; action: 'accept' | 'decline' }) =>
      v.action === 'accept'
        ? companionsApi.accept(v.id, {
            luggageKg: luggage[v.id]?.kg ? Number(luggage[v.id]!.kg) : null,
            luggageDescription: luggage[v.id]?.desc ?? '',
          })
        : companionsApi.decline(v.id),
    onSuccess: (m, v) => {
      void queryClient.invalidateQueries({ queryKey: ['companions'] });
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setNote({
        tone: 'info',
        message:
          m ??
          (v.action === 'accept'
            ? 'You are on the trip. Your boarding pass appears in My trips once the booker pays.'
            : 'Invitation declined.'),
      });
    },
    onError: (e) => setNote({ tone: 'error', message: toApiError(e).message }),
  });
  const incoming = mine.data?.incoming ?? [];

  const card = (c: CompanionInvite) => (
    <View key={c.id} style={styles.card}>
      <View style={styles.row}>
        <Avatar name={c.fromName} size={44} />
        <View style={styles.flex}>
          <Text style={styles.semi}>{c.fromName ?? 'A friend'} wants you on their trip</Text>
          <Text style={shared.subtitle}>
            {[c.routeFrom, c.routeTo].filter(Boolean).join(' → ')}
            {c.departureTime ? ` · ${shortDate(c.departureTime)}` : ''}
          </Text>
        </View>
        <Chip label={c.status} tone={c.status === 'pending' ? 'amber' : 'grey'} />
      </View>
      {c.consent ? (
        <View style={styles.tile}>
          <Text style={styles.tileText}>{c.consent}</Text>
        </View>
      ) : null}
      <Text style={shared.subtitle}>
        {c.fromName ?? 'The booker'} pays for the seat. You travel on your own verified SR2Go
        account.
      </Text>
      {c.status === 'pending' ? (
        <>
          <View style={styles.twoUp}>
            <View style={styles.flex}>
              <TextField
                label="Luggage (kg)"
                keyboardType="numeric"
                value={luggage[c.id]?.kg ?? ''}
                onChangeText={(kg) =>
                  setLuggage((l) => ({ ...l, [c.id]: { kg, desc: l[c.id]?.desc ?? '' } }))
                }
              />
            </View>
            <View style={styles.flex}>
              <TextField
                label="Description"
                value={luggage[c.id]?.desc ?? ''}
                onChangeText={(desc) =>
                  setLuggage((l) => ({ ...l, [c.id]: { kg: l[c.id]?.kg ?? '', desc } }))
                }
              />
            </View>
          </View>
          <View style={styles.twoUp}>
            <Button
              title="Decline"
              variant="secondary"
              onPress={() => act.mutate({ id: c.id, action: 'decline' })}
              style={styles.flex}
            />
            <Button
              title="Accept"
              onPress={() => act.mutate({ id: c.id, action: 'accept' })}
              loading={act.isPending}
              style={styles.flex}
            />
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <Screen
      testID="companion-invites"
      topBar={{ title: 'Trip invitations' }}
      footer={
        <Button
          title="Back to my trips"
          variant="secondary"
          onPress={() => navigation.navigate('Main', { screen: 'Trips' })}
        />
      }
    >
      {note ? (
        <Banner tone={note.tone} message={note.message} onDismiss={() => setNote(null)} />
      ) : null}
      {mine.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {mine.isError ? <Banner tone="error" message={toApiError(mine.error).message} /> : null}
      {!mine.isPending && incoming.length === 0 ? (
        <Text style={shared.subtitle}>No invitations right now.</Text>
      ) : null}
      {incoming.map(card)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { ...typography.body, color: colors.text },
  semi: { ...typography.bodySemibold, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  tile: { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: spacing.md },
  tileText: { ...typography.body, color: colors.navy },
  twoUp: { flexDirection: 'row', gap: spacing.sm },
});
