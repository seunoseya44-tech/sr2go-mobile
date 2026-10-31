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
  const textColor = disabled && !loading ? colors.disabledText : palette.text;

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
        palette.border
          ? { borderWidth: palette.borderWidth ?? 1.5, borderColor: palette.border }
          : null,
        // Build 19 review: disabled = solid light grey, not faded.
        inactive && !loading && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <View style={styles.content}>
          <ActivityIndicator color={palette.text} />
          {loadingTitle ? (
            <Text
              style={[styles.title, { color: palette.text }]}
              numberOfLines={2}
              textBreakStrategy="simple"
              android_hyphenationFrequency="none"
            >
              {loadingTitle}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={textColor} /> : null}
          {/* Build 19 review: up to two lines, centred, breaking only between words. */}
          <Text
            style={[styles.title, { color: textColor }]}
            numberOfLines={2}
            textBreakStrategy="simple"
            android_hyphenationFrequency="none"
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const PALETTES: Record<
  Variant,
  { background: string; pressed: string; text: string; border?: string; borderWidth?: number }
> = {
  primary: { background: colors.brand, pressed: colors.brandPressed, text: colors.textOnBrand },
  // Build 19 review: white with a 2 px brand border and brand text.
  secondary: {
    background: colors.surface,
    pressed: colors.brandSoft,
    text: colors.brand,
    border: colors.brand,
    borderWidth: 2,
  },
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
    paddingHorizontal: spacing.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    maxWidth: '100%',
  },
  title: {
    ...typography.button,
    textAlign: 'center',
    flexShrink: 1,
  },
  disabled: {
    backgroundColor: colors.disabledFill,
    borderColor: colors.disabledFill,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
});
