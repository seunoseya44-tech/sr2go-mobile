import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { bookingsApi } from '../../api/bookings';
import { toApiError } from '../../api/errors';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Avatar, LinkText } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme';
import { bookingView, shared, SummaryCard, VIEW_TEXT } from './shared';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * Screen 12 · Waiting for the driver, and Request closed. Polls the booking
 * every 20 s (the push arrives when Firebase is configured) and moves on to
 * Payment the moment the driver accepts.
 */
export function BookingStatusScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<AppStackParamList, 'BookingStatus'>>();
  const query = useQuery({
    queryKey: ['bookings', params.bookingId],
    queryFn: () => bookingsApi.get(params.bookingId),
    refetchInterval: 20_000,
  });
  const b = query.data ?? null;
  const view = b ? bookingView(b) : null;

  useEffect(() => {
    if (view === 'payNow') navigation.replace('Payment', { bookingId: params.bookingId });
    if (view === 'confirmed' || view === 'boarded') {
      navigation.replace('BookingConfirmation', { bookingId: params.bookingId });
    }
  }, [view, navigation, params.bookingId]);

  const goHome = () => navigation.navigate('Main', { screen: 'Home' });

  if (!b) {
    return (
      <Screen testID="booking-status" topBar={{ leading: 'close', onLeadingPress: goHome }}>
        {query.isError ? (
          <Banner tone="error" message={toApiError(query.error).message} />
        ) : (
          <View style={shared.centered}>
            <ActivityIndicator color={colors.brand} />
          </View>
        )}
      </Screen>
    );
  }

  const closed = view === 'requestClosed' || view === 'declined' || view === 'payExpired';
  const name = b.driverName ?? 'the driver';

  return (
    <Screen
      testID="booking-status"
      topBar={{ leading: 'close', onLeadingPress: goHome }}
      footer={
        closed ? (
          <Button title="Find another ride" onPress={goHome} />
        ) : (
          <>
            <Button title="Back to home" onPress={goHome} />
            <View style={styles.center}>
              <LinkText onPress={() => navigation.navigate('CancelBooking', { bookingId: b.id })}>
                Cancel request
              </LinkText>
            </View>
          </>
        )
      }
    >
      <View style={shared.centered}>
        <View style={[styles.ring, closed && styles.ringClosed]}>
          <Avatar name={b.driverName} size={80} verified={b.driverVerified} />
        </View>
        <Text style={shared.overline}>{closed ? 'Request closed' : 'Request sent'}</Text>
        <Text style={shared.heading}>
          {view === 'declined'
            ? `${name} couldn't take this booking`
            : closed
              ? (VIEW_TEXT[view!].line ?? 'Request closed.')
              : `Waiting for ${name} to accept`}
        </Text>
        {!closed ? (
          <Text style={shared.body}>
            We&apos;ll tell you as soon as {name} answers. If there&apos;s no answer in time, the
            request closes and you are not charged.
          </Text>
        ) : null}
        <SummaryCard booking={b} status={VIEW_TEXT[view!].chip} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  ring: {
    padding: 6,
    borderRadius: 60,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.brand,
    marginBottom: spacing.xs,
  },
  ringClosed: { borderColor: colors.border, borderStyle: 'solid' },
});
