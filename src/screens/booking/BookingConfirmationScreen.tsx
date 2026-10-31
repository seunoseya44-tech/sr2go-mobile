import { ActivityIndicator, Linking, Platform, Share, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { bookingsApi } from '../../api/bookings';
import { companionsApi } from '../../api/social';
import { toApiError } from '../../api/errors';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { QrBox } from '../../components/QrBox';
import { Screen } from '../../components/Screen';
import { Avatar, Chip, InfoBanner, LinkText } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, fonts, radius, spacing, typography } from '../../theme';
import { shortDate } from '../../utils/format';
import { openDirections } from '../RideDetailsScreen';
import { shared } from './shared';
import { ENDPOINTS } from '../../api/client';
import { companyIdOf } from '../../api/features';
import { BusinessTripSwitch } from '../features/FeatureScreens';
import { useAuth } from '../../auth/AuthContext';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * Screen 15 · You're booked. Mirrors SR2Go's confirmation email in the same
 * order. No driver code anywhere (15 Oct): the passenger scans the driver's
 * phone at the car.
 */
export function BookingConfirmationScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'BookingConfirmation'>>();
  const booking = useQuery({
    queryKey: ['bookings', params.bookingId],
    queryFn: () => bookingsApi.get(params.bookingId),
  });
  const b = booking.data ?? null;
  const pass = useQuery({
    queryKey: ['boarding-pass', params.bookingId],
    queryFn: () => bookingsApi.boardingPass(params.bookingId),
    enabled: !!b && b.paymentStatus === 'paid',
    retry: false,
  });
  const contacts = useQuery({
    queryKey: ['contacts', b?.rideId],
    queryFn: () => bookingsApi.contacts(b!.rideId!),
    enabled: !!b?.rideId && b.paymentStatus === 'paid',
    retry: false,
  });

  const companions = useQuery({
    queryKey: ['companions'],
    queryFn: companionsApi.list,
    retry: false,
  });
  const unpaidSeats = (companions.data?.outgoing ?? []).filter(
    (c) =>
      c.bookingId === params.bookingId &&
      c.seat?.status === 'accepted' &&
      c.seat.paymentStatus !== 'paid',
  );
  const share = useMutation({
    mutationFn: async () => {
      const link = await bookingsApi.trackingLink(params.bookingId);
      if (link.whatsappLink && (await Linking.canOpenURL(link.whatsappLink))) {
        await Linking.openURL(link.whatsappLink);
        return;
      }
      await Share.share({ message: link.shareMessage ?? link.trackingUrl ?? '' });
    },
  });

  const goTrips = () => navigation.navigate('Main', { screen: 'Trips' });

  if (!b) {
    return (
      <Screen testID="booking-confirmation" topBar={{ leading: 'close', onLeadingPress: goTrips }}>
        {booking.isError ? (
          <Banner tone="error" message={toApiError(booking.error).message} />
        ) : (
          <View style={shared.centered}>
            <ActivityIndicator color={colors.brand} />
          </View>
        )}
      </Screen>
    );
  }

  const driver = pass.data?.driver ?? null;
  const driverName = driver?.name ?? b.driverName;
  const vehicleLine = driver?.vehicle
    ? [driver.vehicle.colour, driver.vehicle.make, driver.vehicle.model].filter(Boolean).join(' ')
    : b.vehicle;
  const plate = driver?.vehicle?.plate ?? b.plate;
  const contact = contacts.data?.contacts[0] ?? null;
  const paid = b.paymentStatus === 'paid';

  return (
    <Screen
      testID="booking-confirmation"
      topBar={{ leading: 'close', onLeadingPress: goTrips }}
      footer={
        <View style={styles.footerRow}>
          <Button
            title="Share my trip"
            icon="share-social-outline"
            onPress={() => share.mutate()}
            loading={share.isPending}
            style={styles.flex}
          />
          <Button
            title="Add to calendar"
            variant="secondary"
            onPress={() =>
              addToCalendar(b.originCity, b.destinationCity, b.departureDate, b.departureTime)
            }
            style={styles.flex}
          />
        </View>
      }
    >
      <View style={styles.header}>
        {/* Item 10: "booked" only once the seat is paid. */}
        <Ionicons
          name={paid ? 'checkmark-circle' : 'time-outline'}
          size={32}
          color={colors.textOnBrand}
        />
        <Text style={styles.headerTitle}>
          {paid ? "You're booked!" : 'Seat reserved \u2013 pay to confirm'}
        </Text>
        <Text style={styles.headerLine}>
          {b.originCity} → {b.destinationCity} · {shortDate(b.departureDate)}, {b.departureTime}
        </Text>
        {b.reference ? <Text style={styles.headerRef}>Booking ref {b.reference}</Text> : null}
      </View>

      <View style={styles.boardingCard}>
        <QrBox
          value={pass.data?.qrPayload ?? b.qrCodeData}
          size={180}
          code={pass.data?.boardingCode ?? b.boardingCode}
        />
        <Text style={shared.overline}>Boarding code</Text>
        <Text style={styles.code}>{spaced(pass.data?.boardingCode ?? b.boardingCode)}</Text>
        <Text style={shared.small}>Show the QR to your driver. Works without internet.</Text>
        <LinkText onPress={() => navigation.navigate('BoardingPass', { bookingId: b.id })}>
          Open boarding pass
        </LinkText>
      </View>

      <Section label="Your driver">
        <View style={styles.row}>
          <Avatar name={driverName} size={40} verified={driver?.verified ?? b.driverVerified} />
          <Text style={styles.semi}>{driverName ?? 'Driver'}</Text>
        </View>
      </Section>

      <Section label="Look for this car">
        {vehicleLine ? <Text style={styles.body}>{vehicleLine}</Text> : null}
        {plate ? (
          <Text style={styles.plate}>Plate {plate}</Text>
        ) : (
          <Text style={styles.helper}>Plate shown after you pay</Text>
        )}
        {b.isAc ? <Chip label="AC" tone="blue" /> : null}
      </Section>

      {b.meetingPointName ? (
        <Section label="Meeting point">
          <View style={styles.card}>
            <View style={styles.row}>
              <Ionicons name="location-outline" size={22} color={colors.brand} />
              <View style={styles.flex}>
                <Text style={styles.semi}>{b.meetingPointName}</Text>
                {b.meetingPointAddress ? (
                  <Text style={styles.helper}>{b.meetingPointAddress}</Text>
                ) : null}
              </View>
            </View>
            {b.meetingPointLat != null && b.meetingPointLng != null ? (
              <LinkText
                onPress={() =>
                  void openDirections(b.meetingPointLat!, b.meetingPointLng!, b.meetingPointName!)
                }
              >
                Get directions
              </LinkText>
            ) : null}
          </View>
        </Section>
      ) : null}

      <Section label="First contact">
        <View style={[styles.card, styles.row]}>
          <Avatar name={driverName} size={40} />
          <View style={styles.flex}>
            <Text style={styles.semi}>{driverName ?? 'Driver'}</Text>
            <Text style={styles.helper}>Driver</Text>
            {contact?.callsMasked && contact.callNumber ? (
              <Text style={styles.body}>
                Call SR2Go on {contact.callNumber}
                {contact.callCode ? ` · Your call code: ${contact.callCode}` : ''}
              </Text>
            ) : contact?.phone ? (
              <Text style={styles.body}>{contact.phone}</Text>
            ) : (
              <Text style={styles.helper}>
                {contacts.data?.message ?? 'Contact details appear once the trip is confirmed.'}
              </Text>
            )}
          </View>
          {contact?.phone || contact?.callNumber ? (
            <Button
              title="Call"
              icon="call-outline"
              onPress={() =>
                Linking.openURL(`tel:${contact.callsMasked ? contact.callNumber : contact.phone}`)
              }
            />
          ) : null}
        </View>
      </Section>

      {unpaidSeats.length > 0 ? (
        <Button
          title={`Pay for ${unpaidSeats.length} traveller${unpaidSeats.length === 1 ? '' : 's'}`}
          onPress={() => navigation.navigate('Payment', { bookingId: b.id })}
        />
      ) : null}
      <Button
        title="Travelling with"
        variant="secondary"
        icon="people-outline"
        onPress={() => navigation.navigate('TravellingWith', { bookingId: b.id })}
      />
      <Button
        title="Trip day: driver, car, position and SOS"
        variant="secondary"
        icon="navigate-outline"
        onPress={() => navigation.navigate('PassengerTrip', { bookingId: b.id })}
      />
      <View style={styles.linkRow}>
        {b.rideId ? (
          <Button
            title="Message"
            variant="secondary"
            icon="chatbubble-ellipses-outline"
            onPress={() =>
              navigation.navigate('TripChat', {
                rideId: b.rideId!,
                title: driverName ?? 'Trip chat',
                subtitle: `${b.originCity} → ${b.destinationCity} · ${shortDate(b.departureDate)}, ${b.departureTime}`,
              })
            }
            style={styles.flex}
          />
        ) : null}
        <Button
          title="Transfer my ticket"
          variant="secondary"
          icon="swap-horizontal-outline"
          onPress={() => navigation.navigate('TransferTicket', { bookingId: b.id })}
          style={styles.flex}
        />
      </View>
      {paid ? (
        <Button
          title="Journey card"
          variant="secondary"
          icon="document-text-outline"
          onPress={() =>
            navigation.navigate('Document', {
              title: 'Journey card',
              path: ENDPOINTS.journeyCard(b.id),
            })
          }
        />
      ) : null}
      {b.raw.rescue_request_id != null ? (
        <Button
          title="Your driver broke down: choose a rescue ride"
          icon="warning-outline"
          onPress={() =>
            navigation.navigate('Rescue', { rescueId: String(b.raw.rescue_request_id) })
          }
        />
      ) : b.raw.breakdown_id != null ? (
        <Button
          title="Your driver broke down: see rescue"
          icon="warning-outline"
          onPress={() =>
            navigation.navigate('BreakdownOpen', { breakdownId: String(b.raw.breakdown_id) })
          }
        />
      ) : null}
      {b.rideId ? (
        <Button
          title="Meeting point changes"
          variant="secondary"
          icon="location-outline"
          onPress={() =>
            navigation.navigate('MeetingPointProposals', { rideId: b.rideId!, isDriver: false })
          }
        />
      ) : null}
      {companyIdOf(user?.raw) && b.status !== 'completed' ? (
        <BusinessTripSwitch
          bookingId={b.id}
          initial={b.raw.business_trip === true}
          companyName={typeof b.raw.company_name === 'string' ? b.raw.company_name : null}
        />
      ) : null}
      <Button
        title="Report a problem"
        variant="secondary"
        icon="alert-circle-outline"
        onPress={() =>
          navigation.navigate('ReportProblem', {
            bookingId: b.id,
            route: `${b.originCity} → ${b.destinationCity} · ${shortDate(b.departureDate)}`,
            rideId: b.rideId,
          })
        }
      />

      <InfoBanner tone="amber" icon="shield-checkmark-outline">
        Safety tip: At the car, scan or type the code on your driver&apos;s phone, then check their
        photo. Your driver checks yours too.
      </InfoBanner>
      <View style={styles.row}>
        <Ionicons name="shield-outline" size={16} color={colors.textMuted} />
        <Text style={styles.consent}>
          At departure and arrival, your driver&apos;s app records the location and a photo of the
          passengers in the car. It is used only to keep you safe and to settle disputes, and is
          deleted after 90 days unless there is a dispute.
        </Text>
      </View>
    </Screen>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={shared.overline}>{label}</Text>
      {children}
    </View>
  );
}

function spaced(code: string | null): string {
  return code ? code.split('').join(' ') : '— — — —';
}

function addToCalendar(
  from: string | null,
  to: string | null,
  date: string | null,
  time: string | null,
) {
  if (!date) return;
  const start = `${date.replace(/-/g, '')}T${(time ?? '08:00').replace(':', '')}00`;
  const title = encodeURIComponent(`SR2Go: ${from ?? ''} → ${to ?? ''}`);
  const url =
    Platform.OS === 'android'
      ? `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${start}`
      : `calshow:`;
  void Linking.openURL(url).catch(() => undefined);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  headerTitle: { ...typography.title, color: colors.textOnBrand },
  headerLine: {
    ...typography.bodySemibold,
    fontSize: 18,
    lineHeight: 26,
    color: colors.textOnBrand,
  },
  headerRef: { ...typography.secondary, color: colors.textOnBrand, opacity: 0.85 },
  boardingCard: {
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  code: {
    fontFamily: fonts.displayBold,
    fontSize: 40,
    lineHeight: 48,
    color: colors.brand,
    letterSpacing: 4,
  },
  section: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  semi: { ...typography.bodySemibold, color: colors.text },
  body: { ...typography.body, color: colors.text },
  helper: { ...typography.secondary, color: colors.textMuted },
  plate: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
    letterSpacing: 2,
  },
  consent: { ...typography.secondary, color: colors.textMuted, flex: 1 },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  linkRow: { flexDirection: 'row', gap: spacing.sm },
});
