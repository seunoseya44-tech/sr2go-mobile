import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ridesApi } from '../api/rides';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import {
  Avatar,
  Badge,
  Card,
  Chip,
  LinkText,
  PriceBlock,
  RoadLine,
  Stepper,
} from '../components/ui';
import { env } from '../config/env';
import type { AppStackParamList } from '../navigation/types';
import { searchForm, useSearchForm } from '../state/searchForm';
import { colors, radius, spacing, TAP, typography } from '../theme';
import { addDays, chipDate, displayName, greeting, initials } from '../utils/format';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const TRUST = [
  {
    icon: 'shield-checkmark-outline',
    title: 'Verified drivers',
    body: 'NIN or BVN plus live selfie check, via Dojah',
  },
  {
    icon: 'time-outline',
    title: 'Delayed Payout Protection',
    body: 'Payment held 24–48 hours after your trip',
  },
  {
    icon: 'qr-code-outline',
    title: 'QR boarding',
    body: 'Your driver scans your code before you get in',
  },
  {
    icon: 'navigate-outline',
    title: 'GPS trip tracking',
    body: "Share your trip's location with family or friends",
  },
] as const;

/** Screen 04: Home. Greeting, search card, invite card, popular routes, trust tiles. */
export function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const form = useSearchForm();
  const ticker = useQuery({
    queryKey: ['ticker'],
    queryFn: ridesApi.ticker,
    staleTime: 10 * 60_000,
  });

  const canSearch = !!form.origin && !!form.destination;
  const verified = user?.isVerified === true;

  const search = () => {
    if (!form.origin || !form.destination) return;
    navigation.navigate('SearchResults', {
      params: {
        origin: form.origin,
        destination: form.destination,
        date: form.date,
        seats: form.seats,
      },
    });
  };

  return (
    <Screen testID="home-screen" topBar={null} contentStyle={styles.content}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>
          SR<Text style={styles.brandAccent}>2</Text>Go
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
          accessibilityRole="button"
          accessibilityLabel="Profile"
          style={styles.avatarPress}
        >
          <Avatar name={initials(user)} size={36} />
        </Pressable>
      </View>

      <View style={styles.greetingRow}>
        <Text style={styles.greeting} testID="home-greeting">
          {greeting()}, {displayName(user)}
        </Text>
        {verified ? <Badge label="Verified" icon="checkmark" /> : null}
        {env.isStaging ? <Badge label="STAGING" /> : null}
      </View>

      {!verified ? (
        <Pressable
          style={styles.verifyBanner}
          accessibilityRole="button"
          testID="verify-banner"
          onPress={() => navigation.navigate('KycConsent', { next: 'book' })}
        >
          <Ionicons name="shield-outline" size={18} color={colors.navy} />
          <Text style={styles.verifyText}>Verify your identity to book</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.navy} />
        </Pressable>
      ) : null}

      <Card testID="search-card">
        <Text style={styles.cardTitle}>Where are you travelling?</Text>
        <View style={styles.routeRow}>
          <View style={styles.routeLine}>
            <Ionicons name="radio-button-on" size={14} color={colors.brand} />
            <RoadLine vertical length={36} />
            <Ionicons name="location" size={14} color={colors.navy} />
          </View>
          <View style={styles.routeFields}>
            <PlaceField
              label="From"
              value={form.origin?.name}
              placeholder="Where are you leaving from?"
              onPress={() =>
                navigation.navigate('PlacePicker', { field: 'origin', current: form.origin })
              }
              testID="from-field"
            />
            <View style={styles.divider} />
            <PlaceField
              label="To"
              value={form.destination?.name}
              placeholder="Where are you going?"
              onPress={() =>
                navigation.navigate('PlacePicker', {
                  field: 'destination',
                  current: form.destination,
                })
              }
              testID="to-field"
            />
          </View>
          <Pressable
            onPress={() => searchForm.swap()}
            accessibilityRole="button"
            accessibilityLabel="Swap from and to"
            style={styles.swap}
            testID="swap-button"
          >
            <Ionicons name="swap-vertical" size={18} color={colors.navy} />
          </Pressable>
        </View>

        <View style={styles.chipsRow}>
          <View style={styles.dateChips}>
            <Chip
              label={chipDate(form.date)}
              icon="calendar-outline"
              tone="grey"
              onPress={() => searchForm.set({ date: addDays(form.date, 1) })}
              testID="date-chip"
            />
            <Pressable
              onPress={() => searchForm.set({ date: addDays(form.date, -1) })}
              accessibilityLabel="Previous day"
              style={styles.dateArrow}
            >
              <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.seatsRow}>
            <Ionicons name="person-outline" size={16} color={colors.textMuted} />
            <Stepper
              value={form.seats}
              min={1}
              max={4}
              onChange={(seats) => searchForm.set({ seats })}
              testID="seats"
            />
            <Text style={styles.seatsLabel}>seat{form.seats === 1 ? '' : 's'}</Text>
          </View>
        </View>

        <Button title="Find rides" onPress={search} disabled={!canSearch} testID="find-rides" />
      </Card>

      <Card
        tone="blue"
        onPress={() => navigation.navigate('Main', { screen: 'Wallet' })}
        testID="invite-card"
      >
        <Text style={styles.inviteTitle}>Invite friends, earn ride credits</Text>
        <Text style={styles.inviteBody}>
          Earn credits every time a friend you invite travels with SR2Go.
        </Text>
        <View style={styles.inviteLink}>
          <Text style={styles.inviteLinkText}>Share your invite code</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textOnBrand} />
        </View>
      </Card>

      {ticker.data && ticker.data.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular routes</Text>
            <LinkText onPress={() => Linking.openURL(`${env.websiteUrl}/#coverage`)}>
              See all
            </LinkText>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.routes}
          >
            {ticker.data.map((r) => (
              <Card
                key={`${r.origin}-${r.destination}`}
                style={styles.routeCard}
                testID="route-card"
              >
                <Text style={styles.routeName}>{`${r.origin} → ${r.destination}`}</Text>
                <Text style={styles.typical}>Typical fare</Text>
                <PriceBlock
                  payAmount={r.price}
                  usualFare={r.motorParkAnchor}
                  savingsPct={r.savingsPct}
                  align="left"
                  suffix="/seat"
                />
              </Card>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.trustGrid}>
        {TRUST.map((t) => (
          <View key={t.title} style={styles.trustTile}>
            <Ionicons name={t.icon} size={22} color={colors.brand} />
            <Text style={styles.trustTitle}>{t.title}</Text>
            <Text style={styles.trustBody}>{t.body}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

function PlaceField({
  label,
  value,
  placeholder,
  onPress,
  testID,
}: {
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.placeField}
      testID={testID}
    >
      <Text style={styles.placeLabel}>{label}</Text>
      <Text style={[styles.placeValue, !value && styles.placePlaceholder]} numberOfLines={1}>
        {value ?? placeholder}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: typography.heading.fontFamily, fontSize: 22, color: colors.midnight },
  brandAccent: { color: colors.brand },
  avatarPress: { width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center' },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  greeting: { ...typography.title, color: colors.text },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.brandSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: TAP,
  },
  verifyText: { ...typography.bodyMedium, color: colors.navy, flex: 1 },
  cardTitle: { ...typography.heading, color: colors.text },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  routeLine: { alignItems: 'center', gap: 4 },
  routeFields: { flex: 1 },
  divider: { height: 1, backgroundColor: colors.border },
  placeField: { minHeight: 52, justifyContent: 'center', gap: 2 },
  placeLabel: { ...typography.label, color: colors.textMuted },
  placeValue: { ...typography.body, color: colors.text },
  placePlaceholder: { color: colors.textSubtle },
  swap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  dateChips: { flexDirection: 'row', alignItems: 'center' },
  dateArrow: { width: 32, height: TAP, alignItems: 'center', justifyContent: 'center' },
  seatsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  seatsLabel: { ...typography.secondary, color: colors.textMuted },
  inviteTitle: { ...typography.heading, color: colors.textOnBrand },
  inviteBody: { ...typography.body, color: 'rgba(255,255,255,0.85)' },
  inviteLink: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 28 },
  inviteLinkText: { ...typography.bodyMedium, color: colors.textOnBrand },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...typography.heading, color: colors.text },
  routes: { gap: spacing.sm, paddingRight: spacing.xl },
  routeCard: { width: 190 },
  routeName: { ...typography.bodySemibold, color: colors.text },
  typical: { ...typography.label, color: colors.textMuted },
  trustGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  trustTile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.tile,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  trustTitle: { ...typography.bodySemibold, color: colors.text },
  trustBody: { ...typography.secondary, color: colors.textMuted },
});
