import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { driverApi, type RideBooking } from '../../api/driver';
import { toApiError } from '../../api/errors';
import { DISPUTE_LABELS, disputesApi, ratingsApi, type DisputeCategory } from '../../api/social';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { Avatar, Chip, LinkText } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, TAP, typography } from '../../theme';
import { shortDate } from '../../utils/format';
import { ResultIcon, shared } from '../booking/shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View
      style={styles.stars}
      accessibilityRole="adjustable"
      accessibilityLabel={`${value} of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          style={styles.star}
          accessibilityRole="button"
          accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
        >
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={36} color={colors.brand} />
        </Pressable>
      ))}
    </View>
  );
}

const DRIVER_TAGS = [
  'On time',
  'Safe driving',
  'Clean car',
  'Friendly',
  'Comfortable',
  'Good music',
];
const PASSENGER_TAGS = ['On time', 'Polite', 'Respectful of the car'];

/** Screen 40 (passenger) · Rate your trip. Tags go to the front of the comment. */
export function RateTripScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'RateTrip'>>();
  const [score, setScore] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const rate = useMutation({
    mutationFn: () =>
      ratingsApi.rate({
        bookingId: params.bookingId,
        revieweeId: params.revieweeId,
        score,
        tags,
        comment,
      }),
    onSuccess: () => navigation.goBack(),
  });
  return (
    <Screen
      testID="rate-trip"
      topBar={{
        leading: 'none',
        trailing: <LinkText onPress={() => navigation.goBack()}>Skip</LinkText>,
      }}
      footer={
        <Button
          title="Submit rating"
          onPress={() => rate.mutate()}
          disabled={score === 0}
          loading={rate.isPending}
        />
      }
    >
      {params.route ? <Text style={shared.subtitle}>{params.route}</Text> : null}
      {rate.isError ? <Banner tone="error" message={toApiError(rate.error).message} /> : null}
      <View style={shared.centered}>
        <Avatar name={params.name} size={72} />
        <Text style={shared.heading}>How was your trip with {params.name ?? 'your driver'}?</Text>
        <Stars value={score} onChange={setScore} />
      </View>
      <Text style={styles.h}>What went well?</Text>
      <View style={styles.chips}>
        {DRIVER_TAGS.map((t) => (
          <Chip
            key={t}
            label={t}
            tone="grey"
            selected={tags.includes(t)}
            onPress={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}
          />
        ))}
      </View>
      <TextField
        label="Add a comment (optional)"
        value={comment}
        onChangeText={setComment}
        multiline
      />
      {params.rideId ? (
        <LinkText
          onPress={() =>
            navigation.navigate('JourneyRecord', { rideId: params.rideId!, route: params.route })
          }
        >
          See the journey record
        </LinkText>
      ) : null}
    </Screen>
  );
}

/** Screen 40 (driver) · Rate passengers, one card each, one submit. */
export function RatePassengersScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'RatePassengers'>>();
  const bookings = useQuery({
    queryKey: ['ride-bookings', params.rideId],
    queryFn: () => driverApi.rideBookings(params.rideId),
  });
  const [scores, setScores] = useState<Record<string, { score: number; tags: string[] }>>({});
  const list = (bookings.data ?? []).filter((b) => b.paid);
  const submit = useMutation({
    mutationFn: async () => {
      for (const b of list) {
        const s = scores[b.id];
        if (!s || s.score === 0 || !b.passengerId) continue;
        await ratingsApi.rate({
          bookingId: b.id,
          revieweeId: b.passengerId,
          score: s.score,
          tags: s.tags,
          comment: '',
        });
      }
    },
    onSuccess: () => navigation.navigate('DriverMain', { screen: 'MyRides' }),
  });
  const rated = Object.values(scores).some((s) => s.score > 0);

  return (
    <Screen
      testID="rate-passengers"
      topBar={{
        leading: 'none',
        trailing: (
          <LinkText onPress={() => navigation.navigate('DriverMain', { screen: 'MyRides' })}>
            Skip
          </LinkText>
        ),
      }}
      footer={
        <Button
          title="Submit ratings"
          onPress={() => submit.mutate()}
          disabled={!rated}
          loading={submit.isPending}
        />
      }
    >
      <Text style={shared.heading}>How were your passengers?</Text>
      {submit.isError ? <Banner tone="error" message={toApiError(submit.error).message} /> : null}
      {bookings.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {list.map((b: RideBooking) => {
        const s = scores[b.id] ?? { score: 0, tags: [] };
        return (
          <View key={b.id} style={styles.card}>
            <View style={styles.row}>
              <Avatar name={b.passengerName} size={40} verified={b.passengerVerified} />
              <Text style={styles.semi}>{b.passengerName ?? 'Passenger'}</Text>
            </View>
            <Stars
              value={s.score}
              onChange={(n) => setScores((x) => ({ ...x, [b.id]: { ...s, score: n } }))}
            />
            <View style={styles.chips}>
              {PASSENGER_TAGS.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  tone="grey"
                  selected={s.tags.includes(t)}
                  onPress={() =>
                    setScores((x) => ({
                      ...x,
                      [b.id]: {
                        ...s,
                        tags: s.tags.includes(t) ? s.tags.filter((y) => y !== t) : [...s.tags, t],
                      },
                    }))
                  }
                />
              ))}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}

/** Screen 41 · Report a problem. The time window comes from the backend. */
export function ReportProblemScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'ReportProblem'>>();
  const [category, setCategory] = useState<DisputeCategory | null>(null);
  const [description, setDescription] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const report = useMutation({
    mutationFn: () =>
      disputesApi.create({
        bookingId: params.bookingId,
        category: category!,
        description: description.trim(),
        evidenceUrls: [],
      }),
    onSuccess: (m) => setDone(m ?? 'Your report has been sent. SR2Go will reply by email.'),
  });

  if (done) {
    return (
      <Screen
        testID="report-problem"
        topBar={null}
        footer={<Button title="See my reports" onPress={() => navigation.replace('MyReports')} />}
      >
        <View style={shared.centered}>
          <ResultIcon icon="checkmark" tone="blue" />
          <Text style={shared.heading}>Report sent</Text>
          <Text style={shared.body}>{done}</Text>
        </View>
      </Screen>
    );
  }
  return (
    <Screen
      testID="report-problem"
      topBar={{ title: 'Report a problem' }}
      footer={
        <Button
          title="Submit report"
          onPress={() => report.mutate()}
          disabled={!category || description.trim().length < 10}
          loading={report.isPending}
        />
      }
    >
      {params.route ? <Text style={shared.subtitle}>{params.route}</Text> : null}
      {report.isError ? <Banner tone="error" message={toApiError(report.error).message} /> : null}
      <View style={styles.chips}>
        {(Object.keys(DISPUTE_LABELS) as DisputeCategory[]).map((c) => (
          <Chip
            key={c}
            label={DISPUTE_LABELS[c]}
            tone="grey"
            selected={category === c}
            onPress={() => setCategory(c)}
          />
        ))}
      </View>
      <TextField
        label="What happened?"
        placeholder="Tell us what happened, with times if you can."
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Text style={shared.subtitle}>
        Photos can be added once SR2Go confirms the upload endpoint.
      </Text>
      {params.rideId ? (
        <LinkText
          onPress={() =>
            navigation.navigate('JourneyRecord', { rideId: params.rideId!, route: params.route })
          }
        >
          See the journey record
        </LinkText>
      ) : null}
      <LinkText onPress={() => navigation.navigate('TundeChat')}>
        Need a quick answer? Chat with Tunde
      </LinkText>
    </Screen>
  );
}

/** Screen 42 · My reports. */
export function MyReportsScreen() {
  const query = useQuery({ queryKey: ['disputes'], queryFn: disputesApi.mine });
  return (
    <Screen testID="my-reports" topBar={{ title: 'My reports' }}>
      {query.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {query.isError ? <Banner tone="error" message={toApiError(query.error).message} /> : null}
      {query.data?.length === 0 ? (
        <Text style={shared.subtitle}>You have not reported a problem.</Text>
      ) : null}
      {query.data?.map((d) => (
        <View key={d.id} style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.semi}>
              {DISPUTE_LABELS[d.category as DisputeCategory] ?? d.category ?? 'Report'}
            </Text>
            {d.status ? (
              <Chip
                label={d.status.replace(/_/g, ' ')}
                tone={/open|pending|review/i.test(d.status) ? 'blue' : 'grey'}
              />
            ) : null}
          </View>
          {d.route || d.date ? (
            <Text style={shared.subtitle}>
              {[d.route, d.date ? shortDate(d.date) : null].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {d.createdAt ? (
            <Text style={shared.subtitle}>Reported {shortDate(d.createdAt)}</Text>
          ) : null}
          {d.resolution ? <Text style={shared.subtitle}>{d.resolution}</Text> : null}
        </View>
      ))}
      <LinkText
        onPress={() =>
          Linking.openURL('mailto:support@shareride2go.com?subject=Help with a report')
        }
        style={styles.centerLink}
      >
        Need help? Contact support
      </LinkText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h: { ...typography.heading, color: colors.text },
  stars: { flexDirection: 'row', justifyContent: 'center' },
  star: { width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  semi: { ...typography.bodySemibold, color: colors.text },
  centerLink: { alignSelf: 'center' },
});
