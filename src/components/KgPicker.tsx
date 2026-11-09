import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { appConfig } from '../config/appConfig';
import { colors, radius, spacing, typography } from '../theme';

/**
 * 9 Nov 2026 (Martin): the passenger CHOOSES his luggage weight - scroll down 1 to 20 kg - instead of typing it.
 * The top comes from the server (GET /api/app/config luggage_picker_max_kg) and is never above the driver's own
 * limit for the ride. 0 = "No luggage".
 */
export function kgOptions(configMax: number, rideMax: number | null | undefined): number[] {
  const top = Math.max(0, Math.floor(rideMax != null ? Math.min(configMax, rideMax) : configMax));
  return Array.from({ length: top + 1 }, (_, i) => i);
}

export function kgLabel(kg: number | null): string {
  if (kg == null) return 'Choose';
  return kg === 0 ? 'No luggage' : `${kg} kg`;
}

export function KgPicker({
  label = 'Luggage',
  value,
  onChange,
  rideMax,
  testID,
}: {
  label?: string;
  value: number | null;
  onChange: (kg: number) => void;
  rideMax?: number | null;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const options = kgOptions(appConfig().luggagePickerMaxKg, rideMax);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.field}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${kgLabel(value)}`}
        testID={testID}
      >
        <Ionicons name="briefcase-outline" size={18} color={colors.textMuted} />
        <Text style={[styles.value, value == null && styles.placeholder]}>{kgLabel(value)}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      {rideMax != null ? (
        <Text style={styles.helper}>This driver allows up to {rideMax} kg</Text>
      ) : null}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Your luggage weight</Text>
          <FlatList
            data={options}
            keyExtractor={(k) => String(k)}
            initialScrollIndex={value != null && value < options.length ? value : 0}
            getItemLayout={(_, i) => ({ length: ROW, offset: ROW * i, index: i })}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.row, item === value && styles.rowOn]}
                onPress={() => {
                  onChange(item);
                  setOpen(false);
                }}
                testID={`kg-${item}`}
              >
                <Text style={[styles.rowText, item === value && styles.rowTextOn]}>
                  {kgLabel(item)}
                </Text>
                {item === value ? (
                  <Ionicons name="checkmark" size={20} color={colors.brand} />
                ) : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const ROW = 48;

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...typography.bodyMedium, color: colors.text },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  value: { ...typography.body, color: colors.text, flex: 1 },
  placeholder: { color: colors.textMuted },
  helper: { ...typography.secondary, color: colors.textMuted },
  backdrop: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    maxHeight: '60%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  sheetTitle: {
    ...typography.bodySemibold,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    height: ROW,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  rowOn: { backgroundColor: colors.brandSoft },
  rowText: { ...typography.body, color: colors.text },
  rowTextOn: { color: colors.brand, fontWeight: '600' },
});
