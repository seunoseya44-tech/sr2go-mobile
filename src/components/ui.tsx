/**
 * Small shared pieces used across screens: chips, badges, avatars, the
 * dashed road line, segmented controls, checkboxes, list rows and the
 * passenger price block. Kept together because each is a few lines.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors, radius, spacing, TAP, typography } from '../theme';
import { initialsOf, naira } from '../utils/format';

type IconName = keyof typeof Ionicons.glyphMap;

/* ---------- Text helpers ---------- */

export function Heading({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <Text style={[styles.heading, style as object]}>{children}</Text>;
}

export function Subtext({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.subtext, style]}>{children}</Text>;
}

export function Overline({ children }: { children: ReactNode }) {
  return <Text style={styles.overline}>{children}</Text>;
}

export function LinkText({
  children,
  onPress,
  testID,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  testID?: string;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="link"
      testID={testID}
      style={styles.linkPress}
    >
      <Text style={[styles.link, style]}>{children}</Text>
    </Pressable>
  );
}

/* ---------- Chips and badges ---------- */

type ChipTone = 'blue' | 'grey' | 'amber' | 'solid';

export function Chip({
  label,
  tone = 'grey',
  icon,
  onPress,
  selected,
  testID,
}: {
  label: string;
  tone?: ChipTone;
  icon?: IconName;
  onPress?: () => void;
  selected?: boolean;
  testID?: string;
}) {
  const t = selected ? CHIP_TONES.solid : CHIP_TONES[tone];
  const inner = (
    <View style={[styles.chip, { backgroundColor: t.bg }]}>
      {icon ? <Ionicons name={icon} size={14} color={t.fg} /> : null}
      <Text style={[styles.chipText, { color: t.fg }]}>{label}</Text>
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
      style={styles.chipPress}
    >
      {inner}
    </Pressable>
  );
}

const CHIP_TONES: Record<ChipTone, { bg: string; fg: string }> = {
  blue: { bg: colors.brandSoft, fg: colors.navy },
  grey: { bg: colors.tile, fg: colors.text },
  amber: { bg: colors.warningSoft, fg: colors.warning },
  solid: { bg: colors.brand, fg: colors.textOnBrand },
};

/** Small solid-blue badge, e.g. "Verified" or "Save 20%". */
export function Badge({ label, icon }: { label: string; icon?: IconName }) {
  return (
    <View style={styles.badge}>
      {icon ? <Ionicons name={icon} size={12} color={colors.textOnBrand} /> : null}
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

/* ---------- Avatar ---------- */

export function Avatar({
  name,
  size = 44,
  verified,
}: {
  name: string | null;
  size?: number;
  verified?: boolean;
}) {
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
        accessibilityLabel={name ?? undefined}
      >
        <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initialsOf(name ?? '')}</Text>
      </View>
      {verified ? (
        <View style={styles.avatarTick}>
          <Ionicons name="checkmark" size={10} color={colors.textOnBrand} />
        </View>
      ) : null}
    </View>
  );
}

/* ---------- Road line (dashed brand motif) ---------- */

export function RoadLine({
  vertical = false,
  length = 24,
  color = colors.brand,
}: {
  vertical?: boolean;
  length?: number;
  color?: string;
}) {
  const dashes = Math.max(1, Math.floor(length / 8));
  return (
    <View
      style={[
        vertical
          ? { height: length, width: 2, flexDirection: 'column' }
          : { width: length, height: 2, flexDirection: 'row' },
        styles.roadLine,
      ]}
      accessible={false}
    >
      {Array.from({ length: dashes }).map((_, i) => (
        <View
          key={i}
          style={
            vertical
              ? { width: 2, height: 4, backgroundColor: color, borderRadius: 1 }
              : { height: 2, width: 4, backgroundColor: color, borderRadius: 1 }
          }
        />
      ))}
    </View>
  );
}

/* ---------- Segmented control ---------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}) {
  return (
    <View style={styles.segmented} testID={testID} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            testID={testID ? `${testID}-${o.value}` : undefined}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Checkbox ---------- */

export function Checkbox({
  checked,
  onChange,
  children,
  testID,
  error,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
  testID?: string;
  error?: string;
}) {
  return (
    <View style={styles.checkboxWrap}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        testID={testID}
        style={styles.checkboxRow}
      >
        <View
          style={[
            styles.checkbox,
            checked && styles.checkboxChecked,
            !!error && styles.checkboxError,
          ]}
        >
          {checked ? <Ionicons name="checkmark" size={16} color={colors.textOnBrand} /> : null}
        </View>
        <Text style={styles.checkboxLabel}>{children}</Text>
      </Pressable>
      {error ? <Text style={styles.checkboxErrorText}>{error}</Text> : null}
    </View>
  );
}

/* ---------- Stepper (seat count) ---------- */

export function Stepper({
  value,
  min = 1,
  max = 4,
  onChange,
  testID,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  testID?: string;
}) {
  const btn = (icon: IconName, delta: number, disabled: boolean, label: string) => (
    <Pressable
      onPress={() => onChange(value + delta)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID ? `${testID}-${delta > 0 ? 'plus' : 'minus'}` : undefined}
      style={[styles.stepBtn, disabled && styles.stepBtnDisabled]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {btn('remove', -1, value <= min, 'Fewer seats')}
      <Text style={styles.stepValue} testID={testID ? `${testID}-value` : undefined}>
        {value}
      </Text>
      {btn('add', 1, value >= max, 'More seats')}
    </View>
  );
}

/* ---------- List row ---------- */

export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  trailing,
  testID,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      testID={testID}
      style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.tile }]}
    >
      {icon ? <Ionicons name={icon} size={22} color={colors.navy} /> : null}
      <View style={styles.listRowText}>
        <Text style={styles.listRowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.listRowSubtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ??
        (onPress ? <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} /> : null)}
    </Pressable>
  );
}

/* ---------- Price block ---------- */

/**
 * The passenger price: bold amount, crossed-out usual fare and a "Save X%"
 * badge when the API returns them (null on city trips). Never calculated.
 */
export function PriceBlock({
  payAmount,
  usualFare,
  savingsPct,
  align = 'right',
  size = 'md',
  suffix,
}: {
  payAmount: string | null;
  usualFare: string | null;
  savingsPct: number | null;
  align?: 'left' | 'right';
  size?: 'md' | 'lg';
  /** e.g. "/seat" on popular routes */
  suffix?: string;
}) {
  const alignStyle = align === 'right' ? styles.priceRight : styles.priceLeft;
  return (
    <View style={[styles.priceBlock, alignStyle]}>
      <Text style={[size === 'lg' ? styles.priceLg : styles.price]} testID="price-amount">
        {naira(payAmount)}
        {suffix ? <Text style={styles.priceSuffix}>{suffix}</Text> : null}
      </Text>
      {usualFare || savingsPct != null ? (
        <View style={[styles.priceRow, alignStyle]}>
          {usualFare ? <Text style={styles.usualFare}>Usual fare {naira(usualFare)}</Text> : null}
          {savingsPct != null ? <Badge label={`Save ${Math.round(savingsPct)}%`} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/* ---------- Card ---------- */

export function Card({
  children,
  style,
  tone = 'outlined',
  onPress,
  testID,
}: {
  children: ReactNode;
  style?: ViewStyle;
  tone?: 'outlined' | 'tile' | 'blue';
  onPress?: () => void;
  testID?: string;
}) {
  const toneStyle =
    tone === 'tile' ? styles.cardTile : tone === 'blue' ? styles.cardBlue : styles.cardOutlined;
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        testID={testID}
        style={({ pressed }) => [styles.card, toneStyle, style, pressed && { opacity: 0.9 }]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[styles.card, toneStyle, style]} testID={testID}>
      {children}
    </View>
  );
}

/** Light-blue information banner with an icon. */
export function InfoBanner({
  children,
  tone = 'blue',
  icon,
  testID,
}: {
  children: ReactNode;
  tone?: 'blue' | 'amber' | 'red';
  icon?: IconName;
  testID?: string;
}) {
  const palette =
    tone === 'amber'
      ? { bg: colors.warningSoft, fg: colors.warning, icon: 'information-circle' as IconName }
      : tone === 'red'
        ? { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle' as IconName }
        : { bg: colors.brandSoft, fg: colors.navy, icon: 'information-circle' as IconName };
  return (
    <View style={[styles.infoBanner, { backgroundColor: palette.bg }]} testID={testID}>
      <Ionicons name={icon ?? palette.icon} size={20} color={palette.fg} />
      <Text style={[styles.infoBannerText, { color: tone === 'blue' ? colors.text : palette.fg }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.title, color: colors.text },
  subtext: { ...typography.secondary, color: colors.textMuted },
  overline: { ...typography.overline, color: colors.textMuted, textTransform: 'uppercase' },
  linkPress: { minHeight: TAP, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { ...typography.bodyMedium, color: colors.navy },

  chipPress: { minHeight: TAP, justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  chipText: { ...typography.label, fontSize: 13, lineHeight: 18 },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.brand,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: { ...typography.label, color: colors.textOnBrand },

  avatar: {
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: typography.heading.fontFamily, color: colors.navy },
  avatarTick: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  roadLine: { justifyContent: 'space-between', alignItems: 'center' },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.tile,
    borderRadius: radius.md,
    padding: 3,
  },
  segment: {
    flex: 1,
    minHeight: TAP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segmentActive: { backgroundColor: colors.brand },
  segmentText: { ...typography.bodyMedium, color: colors.text },
  segmentTextActive: { color: colors.textOnBrand },

  checkboxWrap: { gap: spacing.xxs },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, minHeight: TAP },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.textSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkboxError: { borderColor: colors.danger },
  checkboxLabel: { ...typography.body, color: colors.text, flex: 1 },
  checkboxErrorText: { ...typography.secondary, color: colors.danger, marginLeft: 34 },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: TAP,
    height: TAP,
    borderRadius: radius.md,
    backgroundColor: colors.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepValue: { ...typography.heading, color: colors.text, minWidth: 24, textAlign: 'center' },

  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listRowText: { flex: 1, gap: 2 },
  listRowTitle: { ...typography.body, color: colors.text },
  listRowSubtitle: { ...typography.secondary, color: colors.textMuted },

  priceBlock: { gap: spacing.xxs },
  priceLeft: { alignItems: 'flex-start' },
  priceRight: { alignItems: 'flex-end' },
  price: { ...typography.price, color: colors.text },
  priceLg: { ...typography.price, fontSize: 28, lineHeight: 34, color: colors.text },
  priceSuffix: { ...typography.secondary, color: colors.textMuted },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  usualFare: {
    ...typography.secondary,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },

  card: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  cardOutlined: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardTile: { backgroundColor: colors.tile },
  cardBlue: { backgroundColor: colors.navy },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  infoBannerText: { ...typography.body, flex: 1 },
});
