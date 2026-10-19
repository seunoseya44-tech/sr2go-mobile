import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../components/Screen';
import { colors, spacing, typography } from '../theme';

/**
 * Tabs whose screens belong to later batches (B5 Trips, B7 Wallet). They are
 * registered now so the tab bar matches the approved design; the content
 * arrives when those tracker rows are approved.
 */
function Placeholder({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Screen topBar={null} testID={`${title.toLowerCase()}-screen`}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.empty}>
        <Ionicons name={icon} size={36} color={colors.brand} />
        <Text style={styles.body}>{body}</Text>
      </View>
    </Screen>
  );
}

export function WalletScreen() {
  return (
    <Placeholder
      title="Wallet"
      icon="wallet-outline"
      body="Ride credits and your invite code will appear here."
    />
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl },
  body: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
