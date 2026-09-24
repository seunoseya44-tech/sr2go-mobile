import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '../theme';

type Tone = 'error' | 'info' | 'success' | 'warning';

const TONES: Record<
  Tone,
  { background: string; foreground: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  error: { background: colors.dangerSoft, foreground: colors.danger, icon: 'alert-circle' },
  info: { background: colors.brandSoft, foreground: colors.navy, icon: 'information-circle' },
  success: { background: colors.successSoft, foreground: colors.success, icon: 'checkmark-circle' },
  warning: { background: colors.warningSoft, foreground: colors.warning, icon: 'warning' },
};

export interface BannerProps {
  message: string;
  tone?: Tone;
  onDismiss?: () => void;
  testID?: string;
}

export function Banner({ message, tone = 'info', onDismiss, testID }: BannerProps) {
  const t = TONES[tone];
  return (
    <View
      testID={testID}
      style={[styles.container, { backgroundColor: t.background }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <Ionicons name={t.icon} size={20} color={t.foreground} />
      <Text style={[styles.message, { color: t.foreground }]}>{message}</Text>
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
        >
          <Ionicons name="close" size={18} color={t.foreground} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  message: {
    ...typography.label,
    flex: 1,
  },
});
