import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts, radius, spacing, typography } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  icon?: IconName;
  /** Element rendered at the right edge of the input, e.g. a visibility toggle. */
  accessory?: ReactNode;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, icon, accessory, onFocus, onBlur, editable = true, ...inputProps },
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
          { borderColor },
          focused && !error && styles.fieldFocused,
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
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    ...typography.label,
    color: colors.text,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  fieldFocused: {
    backgroundColor: '#FBFDFF',
  },
  fieldDisabled: {
    opacity: 0.6,
  },
  icon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    flexShrink: 1,
  },
});
