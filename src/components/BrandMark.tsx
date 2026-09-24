import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts, radius, spacing } from '../theme';

interface BrandMarkProps {
  /** `light` for dark backgrounds, `dark` for light ones. */
  variant?: 'light' | 'dark';
  size?: 'md' | 'lg';
}

export function BrandMark({ variant = 'light', size = 'lg' }: BrandMarkProps) {
  const large = size === 'lg';
  const textColor = variant === 'light' ? colors.textOnBrand : colors.midnight;

  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="ShareRide2Go">
      <View style={[styles.badge, large ? styles.badgeLg : styles.badgeMd]}>
        <Ionicons name="car-sport" size={large ? 26 : 18} color={colors.textOnBrand} />
      </View>
      <Text style={[styles.word, { color: textColor, fontSize: large ? 28 : 20 }]}>
        SR<Text style={styles.accent}>2</Text>Go
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLg: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
  },
  badgeMd: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
  },
  word: {
    fontFamily: fonts.bold,
    letterSpacing: -0.5,
  },
  accent: {
    color: colors.brand,
  },
});
