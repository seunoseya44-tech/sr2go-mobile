import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import { colors, radius, spacing, typography } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outlineLight' | 'light' | 'danger';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  /** Text shown beside the spinner while loading (e.g. "Logging you in…"). */
  loadingTitle?: string;
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
  loadingTitle,
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
        palette.border ? { borderWidth: 1.5, borderColor: palette.border } : null,
        inactive && !loading && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <View style={styles.content}>
          <ActivityIndicator color={palette.text} />
          {loadingTitle ? (
            <Text style={[styles.title, { color: palette.text }]}>{loadingTitle}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={palette.text} /> : null}
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const PALETTES: Record<
  Variant,
  { background: string; pressed: string; text: string; border?: string }
> = {
  primary: { background: colors.brand, pressed: colors.brandPressed, text: colors.textOnBrand },
  secondary: { background: colors.tile, pressed: colors.border, text: colors.midnight },
  ghost: { background: 'transparent', pressed: colors.brandSoft, text: colors.navy },
  // On the blue splash: white outline, white text.
  outlineLight: {
    background: 'transparent',
    pressed: 'rgba(255,255,255,0.12)',
    text: colors.textOnBrand,
    border: colors.textOnBrand,
  },
  // On the blue splash: solid white, blue text.
  light: { background: colors.textOnBrand, pressed: colors.brandSoft, text: colors.brand },
  danger: { background: colors.danger, pressed: '#BE123C', text: colors.textOnBrand },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
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
