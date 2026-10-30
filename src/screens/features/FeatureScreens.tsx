/**
 * Screens for the server features of 30 Oct: driver boarding list, ride
 * alerts, public reviews, meeting-point change and company booking. Every
 * figure and rule comes from the server; the app only shows the answer.
 */
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { toApiError } from '../../api/errors';
import { companyIdOf, featuresApi, inviteToken } from '../../api/features';
import { searchPlacesLive } from '../../api/places';
import type { Place } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { QrBox } from '../../components/QrBox';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { Avatar, Card, Chip, InfoBanner, Segmented } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { shortDate } from '../../utils/format';
import { shared } from '../booking/shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

function errorText(e: unknown) {
  return toApiError(e).message;
}

/* ================= 1. Driver's boarding list ================= */

/** Every paid passenger, the code and QR the driver shows each one, and where both checks stand. */
export function DriverBoardingListScreen() {
  const { params } = useRoute<RouteProp<AppStackParamList, 'DriverBoardingList'>>();
  const navigation = useNavigation<Nav>();
  const [open, setOpen] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['boarding-list', params.rideId],
    queryFn: () => featuresApi.boardingList(params.rideId),
    refetchInterval: 30_000,
  });
  return (
    <Screen
      testID="driver-boarding-list"
      topBar={{ title: 'Boarding list' }}
      footer={
        <Button
          title="Scan passengers"
          icon="scan-outline"
          onPress={() => navigation.navigate('DriverBoarding', { rideId: params.rideId })}
        />
      }
    >
      <Text style={shared.subtitle}>
        Show each passenger their own code. Photos appear from 3 hours before departure.
      </Text>
      {list.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {list.isError ? <Banner tone="error" message={errorText(list.error)} /> : null}
      {list.data && list.data.length === 0 ? (
        <Text style={shared.subtitle}>No paid passengers yet.</Text>
      ) : null}
      {list.data?.map((p) => (
        <Card key={p.bookingId}>
          <View style={styles.row}>
            {p.photo ? (
              <Image source={{ uri: p.photo }} style={styles.photo} accessibilityLabel="Photo" />
            ) : (
              <Avatar name={p.name} size={52} verified={p.verified} />
            )}
            <View style={styles.flex}>
              <Text style={styles.title}>{p.name ?? 'Passenger'}</Text>
              <Text style={shared.subtitle}>
                {p.seats} seat{p.seats === 1 ? '' : 's'}
                {p.children ? ` · ${p.children} child${p.children === 1 ? '' : 'ren'}` : ''}
              </Text>
            </View>
            <Chip
              label={
                p.held
                  ? 'On hold'
                  : p.boarded
                    ? 'Boarded'
                    : p.driverCheckedPassenger
                      ? 'You checked'
                      : 'Waiting'
              }
              tone={p.held ? 'amber' : p.boarded ? 'solid' : 'grey'}
            />
          </View>
          <View style={styles.checks}>
            <Check ok={p.driverCheckedPassenger} label="You checked their code" />
            <Check ok={p.passengerCheckedDriver} label="They checked your code" />
          </View>
          {p.held ? (
            <InfoBanner tone="amber">Do not board. SR2Go will contact you.</InfoBanner>
          ) : open === p.bookingId ? (
            <View style={styles.qr}>
              <QrBox value={p.driverQrPayload} code={p.driverCode} size={200} />
              <Text style={shared.overline}>Your code for {p.name ?? 'this passenger'}</Text>
              <Text style={styles.code}>{p.driverCode ?? ''}</Text>
              <Button title="Hide" variant="ghost" onPress={() => setOpen(null)} />
            </View>
          ) : (
            <Button
              title={`Show my code to ${p.name ?? 'passenger'}`}
              variant="secondary"
              icon="qr-code-outline"
              onPress={() => setOpen(p.bookingId)}
            />
          )}
        </Card>
      ))}
    </Screen>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.checkRow}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'ellipse-outline'}
        size={18}
        color={ok ? colors.brand : colors.textMuted}
      />
      <Text style={shared.subtitle}>{label}</Text>
    </View>
  );
}

/* ================= 2. Ride alerts ================= */

/** My alerts: the server sends a push and an email when a matching ride is posted. */
export function RideAlertsScreen() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const alerts = useQuery({ queryKey: ['ride-alerts'], queryFn: featuresApi.alerts });
  const remove = useMutation({
    mutationFn: featuresApi.deleteAlert,
    onSuccess: () => {
      setNote('Alert removed.');
      void queryClient.invalidateQueries({ queryKey: ['ride-alerts'] });
    },
    onError: (e) => setNote(errorText(e)),
  });
  return (
    <Screen testID="ride-alerts" topBar={{ title: 'Ride alerts' }}>
      <Text style={shared.subtitle}>
        We tell you by notification and email when a driver posts a ride on these routes. To add
        one, search a route and tap &quot;Alert me&quot;.
      </Text>
      {note ? <Banner tone="info" message={note} onDismiss={() => setNote(null)} /> : null}
      {alerts.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {alerts.isError ? <Banner tone="error" message={errorText(alerts.error)} /> : null}
      {alerts.data && alerts.data.length === 0 ? (
        <Text style={shared.subtitle}>No alerts yet.</Text>
      ) : null}
      {alerts.data?.map((a) => (
        <Card key={a.id}>
          <View style={styles.row}>
            <Ionicons name="notifications-outline" size={22} color={colors.navy} />
            <View style={styles.flex}>
              <Text style={styles.title}>
                {a.from ?? 'From'} → {a.to ?? 'To'}
              </Text>
              <Text style={shared.subtitle}>
                {shortDate(a.date)}
                {a.seats ? ` · ${a.seats} seat${a.seats === 1 ? '' : 's'}` : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => remove.mutate(a.id)}
              accessibilityRole="button"
              accessibilityLabel="Delete alert"
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

/* ================= 3. Public reviews ================= */

/** A user's public reviews with replies; reply and flag where the server allows. */
export function PublicReviewsScreen() {
  const { params } = useRoute<RouteProp<AppStackParamList, 'PublicReviews'>>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [text, setText] = useState('');
  const reviews = useQuery({
    queryKey: ['public-reviews', params.userId],
    queryFn: () => featuresApi.reviews(params.userId),
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['public-reviews', params.userId] });
  const reply = useMutation({
    mutationFn: () => featuresApi.reply(replyTo!, text.trim()),
    onSuccess: (m) => {
      setNote(m);
      setReplyTo(null);
      setText('');
      refresh();
    },
    onError: (e) => setNote(errorText(e)),
  });
  const flag = useMutation({
    mutationFn: featuresApi.flag,
    onSuccess: setNote,
    onError: (e) => setNote(errorText(e)),
  });
  const s = reviews.data;
  const signedIn = !!user;
  return (
    <Screen
      testID="public-reviews"
      topBar={{ title: `Reviews${params.name ? ` · ${params.name}` : ''}` }}
    >
      {note ? <Banner tone="info" message={note} onDismiss={() => setNote(null)} /> : null}
      {reviews.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {reviews.isError ? <Banner tone="error" message={errorText(reviews.error)} /> : null}
      {s ? (
        <View style={styles.statsRow}>
          <Chip label={`${s.testimonies} good`} tone="blue" icon="star-outline" />
          <Chip label={`${s.complaints} complaints`} tone="amber" icon="warning-outline" />
        </View>
      ) : null}
      {s && s.reviews.length === 0 ? <Text style={shared.subtitle}>No reviews yet.</Text> : null}
      {s?.reviews.map((r) => (
        <Card key={r.id}>
          <View style={styles.row}>
            <Ionicons
              name={r.complaint ? 'warning' : 'star'}
              size={18}
              color={r.complaint ? colors.danger : colors.brand}
            />
            <Text style={[styles.title, styles.flex]}>{r.author ?? 'SR2Go traveller'}</Text>
            <Text style={shared.small}>{shortDate(r.createdAt)}</Text>
          </View>
          <Text style={styles.body}>{r.body}</Text>
          {r.replies.map((x) => (
            <View key={x.id} style={styles.reply}>
              <Text style={styles.replyAuthor}>
                {x.author ?? 'Reply'}
                {x.role ? ` · ${x.role.replace(/_/g, ' ')}` : ''}
              </Text>
              <Text style={styles.body}>{x.body}</Text>
            </View>
          ))}
          {signedIn ? (
            replyTo === r.id ? (
              <View style={styles.gap}>
                <TextField
                  label="Your reply"
                  value={text}
                  onChangeText={setText}
                  multiline
                  maxLength={1000}
                />
                <View style={styles.twoUp}>
                  <Button
                    title="Cancel"
                    variant="ghost"
                    onPress={() => setReplyTo(null)}
                    style={styles.flex}
                  />
                  <Button
                    title="Send reply"
                    onPress={() => reply.mutate()}
                    loading={reply.isPending}
                    disabled={!text.trim()}
                    style={styles.flex}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable onPress={() => setReplyTo(r.id)} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.action}>Reply</Text>
                </Pressable>
                <Pressable onPress={() => flag.mutate(r.id)} accessibilityRole="button" hitSlop={8}>
                  <Text style={[styles.action, styles.danger]}>Flag</Text>
                </Pressable>
              </View>
            )
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

/** Write a public review after a shared, completed trip. */
export function WriteReviewScreen() {
  const { params } = useRoute<RouteProp<AppStackParamList, 'WriteReview'>>();
  const navigation = useNavigation<Nav>();
  const [kind, setKind] = useState<'good' | 'complaint'>('good');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () =>
      featuresApi.writeReview({
        subjectId: params.subjectId,
        bookingId: params.bookingId,
        body: body.trim(),
        complaint: kind === 'complaint',
      }),
    onSuccess: () =>
      navigation.replace('PublicReviews', { userId: params.subjectId, name: params.name }),
    onError: (e) => setError(errorText(e)),
  });
  return (
    <Screen
      testID="write-review"
      topBar={{ title: 'Public review' }}
      footer={
        <Button
          title="Post review"
          onPress={() => send.mutate()}
          loading={send.isPending}
          disabled={body.trim().length < 3}
        />
      }
    >
      <Text style={shared.heading}>About {params.name ?? 'your co-traveller'}</Text>
      <Text style={shared.subtitle}>
        Public reviews are shown to everyone straight away, and {params.name ?? 'they'} can reply.
      </Text>
      {error ? <Banner tone="error" message={error} /> : null}
      <Segmented
        options={[
          { value: 'good', label: 'Good experience' },
          { value: 'complaint', label: 'Complaint' },
        ]}
        value={kind}
        onChange={setKind}
      />
      <TextField
        label="Your review"
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={2000}
      />
    </Screen>
  );
}

/* ================= 4. Meeting-point change ================= */

/**
 * Driver proposes a new meeting point (picked from /api/places so it has
 * lat/lng); everyone on the trip agrees or not. Closes 2 hours before
 * departure: the server answers with the reason when it is too late.
 */
export function MeetingPointProposalsScreen() {
  const { params } = useRoute<RouteProp<AppStackParamList, 'MeetingPointProposals'>>();
  const queryClient = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Place | null>(null);
  const [why, setWhy] = useState('');
  const proposals = useQuery({
    queryKey: ['mp-proposals', params.rideId],
    queryFn: () => featuresApi.proposals(params.rideId),
  });
  const places = useQuery({
    queryKey: ['mp-places', q],
    queryFn: () => searchPlacesLive(q),
    enabled: params.isDriver && q.trim().length >= 2 && !picked,
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['mp-proposals', params.rideId] });
  const propose = useMutation({
    mutationFn: () =>
      featuresApi.propose(params.rideId, {
        name: picked!.name,
        address: picked!.detail ?? picked!.city ?? null,
        lat: picked!.lat,
        lng: picked!.lng,
        note: why.trim(),
      }),
    onSuccess: (m) => {
      setNote(m);
      setPicked(null);
      setQ('');
      setWhy('');
      refresh();
    },
    onError: (e) => setNote(errorText(e)),
  });
  const respond = useMutation({
    mutationFn: (v: { id: string; accept: boolean }) =>
      featuresApi.respond(params.rideId, v.id, v.accept),
    onSuccess: (m) => {
      setNote(m);
      refresh();
    },
    onError: (e) => setNote(errorText(e)),
  });

  return (
    <Screen testID="meeting-point-proposals" topBar={{ title: 'Change meeting point' }}>
      <Text style={shared.subtitle}>
        The driver proposes, everyone on the trip agrees. Changes close 2 hours before departure.
      </Text>
      {note ? <Banner tone="info" message={note} onDismiss={() => setNote(null)} /> : null}
      {proposals.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {proposals.isError ? <Banner tone="error" message={errorText(proposals.error)} /> : null}
      {proposals.data?.map((p) => (
        <Card key={p.id}>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={22} color={colors.brand} />
            <View style={styles.flex}>
              <Text style={styles.title}>{p.name}</Text>
              {p.address ? <Text style={shared.subtitle}>{p.address}</Text> : null}
            </View>
            {p.status ? <Chip label={p.status.replace(/_/g, ' ')} tone="grey" /> : null}
          </View>
          {p.note ? <Text style={styles.body}>{p.note}</Text> : null}
          {p.accepted != null || p.pending != null ? (
            <Text style={shared.subtitle}>
              {p.accepted ?? 0} agreed{p.pending != null ? ` · ${p.pending} waiting` : ''}
            </Text>
          ) : null}
          {!params.isDriver && (p.status == null || /pending|open/i.test(p.status)) ? (
            p.myAnswer == null ? (
              <View style={styles.twoUp}>
                <Button
                  title="No"
                  variant="secondary"
                  onPress={() => respond.mutate({ id: p.id, accept: false })}
                  style={styles.flex}
                />
                <Button
                  title="Agree"
                  onPress={() => respond.mutate({ id: p.id, accept: true })}
                  loading={respond.isPending}
                  style={styles.flex}
                />
              </View>
            ) : (
              <Text style={shared.subtitle}>You {p.myAnswer ? 'agreed' : 'said no'}.</Text>
            )
          ) : null}
        </Card>
      ))}
      {proposals.data && proposals.data.length === 0 ? (
        <Text style={shared.subtitle}>No changes proposed for this trip.</Text>
      ) : null}

      {params.isDriver ? (
        <View style={styles.gap}>
          <Text style={shared.overline}>Propose a new meeting point</Text>
          {picked ? (
            <Card tone="blue">
              <View style={styles.row}>
                <Ionicons name="location" size={22} color={colors.brand} />
                <View style={styles.flex}>
                  <Text style={styles.title}>{picked.name}</Text>
                  <Text style={shared.subtitle}>{picked.detail ?? picked.city}</Text>
                </View>
                <Pressable onPress={() => setPicked(null)} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.action}>Change</Text>
                </Pressable>
              </View>
            </Card>
          ) : (
            <>
              <TextField
                label="Search a place"
                placeholder="e.g. Total filling station, Offa Garage"
                value={q}
                onChangeText={setQ}
                autoCorrect={false}
              />
              {places.data?.slice(0, 6).map((p) => (
                <Pressable
                  key={`${p.name}-${p.lat}-${p.lng}`}
                  onPress={() => setPicked(p)}
                  style={styles.place}
                  accessibilityRole="button"
                >
                  <Text style={styles.title}>{p.name}</Text>
                  <Text style={shared.subtitle}>{p.detail ?? p.city}</Text>
                </Pressable>
              ))}
            </>
          )}
          <TextField
            label="Why the change? (optional)"
            value={why}
            onChangeText={setWhy}
            multiline
            maxLength={300}
          />
          <Button
            title="Send to everyone on this trip"
            onPress={() => propose.mutate()}
            loading={propose.isPending}
            disabled={!picked}
          />
        </View>
      ) : null}
    </Screen>
  );
}

/* ================= 5. Company booking (employee side) ================= */

/** Paste or open an invite link: see the company, the privacy notice, then join. */
export function JoinCompanyScreen() {
  const { params } = useRoute<RouteProp<AppStackParamList, 'JoinCompany'>>();
  const navigation = useNavigation<Nav>();
  const { refreshProfile } = useAuth();
  const [input, setInput] = useState(params?.token ?? '');
  const token = inviteToken(input);
  const invite = useQuery({
    queryKey: ['company-invite', token],
    queryFn: () => featuresApi.validateInvite(token),
    enabled: token.length >= 8,
    retry: false,
  });
  const [done, setDone] = useState<string | null>(null);
  const join = useMutation({
    mutationFn: () => featuresApi.acceptInvite(token),
    onSuccess: async (m) => {
      await refreshProfile().catch(() => undefined);
      setDone(m);
    },
  });
  const company = invite.data?.company ?? 'this company';

  if (done) {
    return (
      <Screen
        testID="join-company"
        topBar={{ title: 'Company' }}
        footer={<Button title="Done" onPress={() => navigation.goBack()} />}
      >
        <View style={shared.centered}>
          <Ionicons name="business" size={48} color={colors.brand} />
          <Text style={shared.heading}>{done}</Text>
          <Text style={shared.body}>
            Switch &quot;Business trip&quot; on for a booking to add it to {company}&apos;s report.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      testID="join-company"
      topBar={{ title: 'Join your company' }}
      footer={
        invite.data ? (
          <>
            <Button
              title={`Join ${company}`}
              onPress={() => join.mutate()}
              loading={join.isPending}
            />
            <Button title="Not now" variant="secondary" onPress={() => navigation.goBack()} />
          </>
        ) : undefined
      }
    >
      <TextField
        label="Invite link or code"
        placeholder="Paste the link from your invite email"
        value={input}
        onChangeText={setInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {invite.isFetching ? <ActivityIndicator color={colors.brand} /> : null}
      {invite.isError ? (
        <Banner
          tone="error"
          message={
            toApiError(invite.error).status === 404
              ? 'This invite has expired or was cancelled. Ask your company for a new one.'
              : errorText(invite.error)
          }
        />
      ) : null}
      {join.isError ? <Banner tone="error" message={errorText(join.error)} /> : null}
      {invite.data ? (
        <Card>
          <View style={styles.row}>
            <Ionicons name="business-outline" size={26} color={colors.navy} />
            <View style={styles.flex}>
              <Text style={styles.title}>{company}</Text>
              {invite.data.email ? (
                <Text style={shared.subtitle}>Invite for {invite.data.email}</Text>
              ) : null}
            </View>
          </View>
          <InfoBanner tone="blue" icon="eye-outline">
            {invite.data.notice ??
              `${company} will see the trips you mark as business trips. Your other trips stay private.`}
          </InfoBanner>
        </Card>
      ) : null}
    </Screen>
  );
}

/** The employee's company. */
export function MyCompanyScreen() {
  const { user } = useAuth();
  const corpId = companyIdOf(user?.raw);
  const company = useQuery({
    queryKey: ['company', corpId],
    queryFn: () => featuresApi.company(corpId!),
    enabled: !!corpId,
  });
  return (
    <Screen testID="my-company" topBar={{ title: 'My company' }}>
      {company.isPending && corpId ? <ActivityIndicator color={colors.brand} /> : null}
      {company.isError ? <Banner tone="error" message={errorText(company.error)} /> : null}
      {company.data ? (
        <Card>
          <View style={styles.row}>
            <Ionicons name="business-outline" size={26} color={colors.navy} />
            <View style={styles.flex}>
              <Text style={styles.title}>{company.data.name ?? 'Your company'}</Text>
              {company.data.email ? (
                <Text style={shared.subtitle}>{company.data.email}</Text>
              ) : null}
            </View>
          </View>
        </Card>
      ) : null}
      <InfoBanner tone="blue" icon="eye-outline">
        Your company sees only the trips you switch to &quot;Business trip&quot;, and only once they
        are completed and paid. You can change the switch on a booking until the trip starts.
      </InfoBanner>
    </Screen>
  );
}

/** "Business trip" switch on a booking, shown only to company employees, until the trip starts. */
export function BusinessTripSwitch({
  bookingId,
  initial,
  companyName,
}: {
  bookingId: string;
  initial: boolean;
  companyName: string | null;
}) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (v: boolean) => featuresApi.setBusinessTrip(bookingId, v),
    onMutate: (v) => {
      setError(null);
      setOn(v);
    },
    onError: (e, v) => {
      setOn(!v);
      setError(errorText(e));
    },
  });
  return (
    <View style={styles.gap}>
      <View style={styles.row}>
        <Ionicons name="briefcase-outline" size={22} color={colors.navy} />
        <View style={styles.flex}>
          <Text style={styles.title}>Business trip{companyName ? ` · ${companyName}` : ''}</Text>
          <Text style={shared.subtitle}>
            {on
              ? 'Goes into your company’s monthly report.'
              : 'Personal trip. Your company won’t see it.'}
          </Text>
        </View>
        <Switch
          value={on}
          onValueChange={(v) => save.mutate(v)}
          disabled={save.isPending}
          trackColor={{ true: colors.brand, false: colors.border }}
          accessibilityLabel="Business trip"
        />
      </View>
      {error ? <Banner tone="error" message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  twoUp: { flexDirection: 'row', gap: spacing.sm },
  statsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  title: { ...typography.bodySemibold, color: colors.text },
  body: { ...typography.body, color: colors.text },
  photo: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.tile },
  checks: { gap: spacing.xxs },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  qr: { alignItems: 'center', gap: spacing.xs },
  code: { ...typography.title, letterSpacing: 6, color: colors.navy },
  reply: {
    marginLeft: spacing.md,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    gap: 2,
  },
  replyAuthor: { ...typography.label, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: spacing.lg },
  action: { ...typography.bodyMedium, color: colors.navy },
  danger: { color: colors.danger },
  place: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.tile,
    gap: 2,
  },
});
