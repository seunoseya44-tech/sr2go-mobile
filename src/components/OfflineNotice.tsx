import { StyleSheet, Text, View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, typography } from '../theme';

/** Slim strip shown while the device has no internet connection. */
export function OfflineNotice() {
  const { isInternetReachable } = useNetInfo();

  // `null` means "not determined yet"; only warn once we know we're offline.
  if (isInternetReachable !== false) return null;

  return (
    <View style={styles.bar} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={16} color={colors.textOnBrand} />
      <Text style={styles.text}>You’re offline. Some features may not work.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.midnight,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  text: {
    ...typography.caption,
    color: colors.textOnBrand,
  },
});
