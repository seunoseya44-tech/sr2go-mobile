import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, radius, spacing, typography } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  testID,
}: ButtonProps) {
  const inactive = disabled || loading;
  const palette = PALETTES[variant];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed ? palette.pressed : palette.background },
        variant === 'secondary' && styles.outlined,
        inactive && !loading && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={palette.text} /> : null}
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const PALETTES: Record<Variant, { background: string; pressed: string; text: string }> = {
  primary: { background: colors.brand, pressed: colors.brandPressed, text: colors.textOnBrand },
  secondary: { background: colors.surface, pressed: colors.brandSoft, text: colors.navy },
  ghost: { background: 'transparent', pressed: colors.brandSoft, text: colors.brand },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  outlined: {
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.button,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
});
