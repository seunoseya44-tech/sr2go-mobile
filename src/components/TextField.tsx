import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts, spacing, typography } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  /** Grey helper text under the field (hidden while an error shows). */
  helper?: string;
  icon?: IconName;
  /** Fixed text before the input, e.g. "+234". */
  prefix?: string;
  /** Element rendered at the right edge of the input, e.g. a visibility toggle. */
  accessory?: ReactNode;
}

/**
 * Underline-style input (label above, 1px bottom line that turns blue on
 * focus), as on the approved wireframes.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    error,
    helper,
    icon,
    prefix,
    accessory,
    onFocus,
    onBlur,
    editable = true,
    ...inputProps
  },
  ref,
) {
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.danger : focused ? colors.borderFocus : colors.border;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.field,
          { borderBottomColor: borderColor, borderBottomWidth: focused || error ? 2 : 1 },
          !editable && styles.fieldDisabled,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={20}
            color={focused ? colors.brand : colors.textSubtle}
            style={styles.icon}
          />
        ) : null}
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          ref={ref}
          style={styles.input}
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.brand}
          editable={editable}
          accessibilityLabel={label}
          accessibilityHint={error}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...inputProps}
        />
        {accessory}
      </View>
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={14} color={colors.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xxs,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    backgroundColor: colors.surface,
  },
  fieldDisabled: {
    opacity: 0.6,
  },
  icon: {
    marginRight: spacing.sm,
  },
  prefix: {
    ...typography.bodyMedium,
    color: colors.text,
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginTop: spacing.xxs,
  },
  error: {
    ...typography.secondary,
    color: colors.danger,
    flexShrink: 1,
  },
  helper: {
    ...typography.secondary,
    color: colors.textMuted,
    marginTop: spacing.xxs,
  },
});
