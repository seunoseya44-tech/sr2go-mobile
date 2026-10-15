import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Ride } from '../api/types';
import { colors, spacing, typography } from '../theme';
import { vehicleLabel } from '../utils/format';
import { Avatar, Card, Chip, PriceBlock } from './ui';

/**
 * Ride card (wireframe 8): time, vehicle, seats left, meeting point, driver,
 * badges, and the price block. No durations, no fee lines, no seat labels.
 */
export function RideCard({ ride, onPress }: { ride: Ride; onPress: () => void }) {
  const full = ride.seatsLeft != null && ride.seatsLeft <= 0;
  return (
    <Card onPress={onPress} testID={`ride-card-${ride.id}`} style={full ? styles.full : undefined}>
      <View style={styles.row}>
        <Text style={styles.time}>{ride.departureTime ?? '--:--'}</Text>
        <Text style={styles.vehicle}>{vehicleLabel(ride.vehicleType)}</Text>
        <View style={styles.flex} />
        {ride.seatsLeft != null ? (
          <Chip
            label={
              full
                ? 'Fully booked'
                : `${ride.seatsLeft} seat${ride.seatsLeft === 1 ? '' : 's'} left`
            }
            tone={full ? 'grey' : 'blue'}
          />
        ) : null}
      </View>

      {ride.meetingPointName ? (
        <View style={styles.row}>
          <Ionicons name="location-outline" size={16} color={colors.brand} />
          <Text style={styles.meeting} numberOfLines={1}>
            {ride.meetingPointName}
          </Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <Avatar name={ride.driverName} size={32} verified={ride.driverVerified} />
        <Text style={styles.driver}>{ride.driverName ?? 'Driver'}</Text>
        {ride.driverRating != null ? (
          <Text style={styles.rating}>★ {ride.driverRating.toFixed(1)}</Text>
        ) : null}
      </View>

      <View style={styles.bottom}>
        <View style={styles.badges}>
          <Chip
            label={ride.autoApprove ? 'Instant booking' : 'Driver approves requests'}
            tone="blue"
            icon={ride.autoApprove ? 'flash-outline' : undefined}
          />
          {ride.isAc ? <Chip label="AC" tone="blue" /> : null}
        </View>
        <PriceBlock
          payAmount={ride.payAmount}
          usualFare={ride.usualFare}
          savingsPct={ride.savingsPct}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  full: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  time: { ...typography.heading, color: colors.text },
  vehicle: { ...typography.body, color: colors.text, marginLeft: spacing.xxs },
  meeting: { ...typography.secondary, color: colors.textMuted, flex: 1 },
  driver: { ...typography.body, color: colors.text },
  rating: { ...typography.secondary, color: colors.textMuted },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  badges: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
