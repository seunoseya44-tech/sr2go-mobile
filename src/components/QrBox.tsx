import { Image, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { colors, radius, spacing, typography } from '../theme';

/**
 * Draws a boarding QR from whatever the backend gives: an image URL, a data
 * URL, a signed token (S2G1…) or, as a last resort, the 4-digit code.
 */
export function QrBox({
  value,
  code,
  size = 200,
}: {
  value: string | null;
  code?: string | null;
  size?: number;
}) {
  const data = value ?? code ?? null;
  if (!data) {
    return (
      <View style={[styles.empty, { width: size, height: size }]}>
        <Text style={styles.emptyText}>QR available once paid</Text>
      </View>
    );
  }
  if (/^(https?:\/\/|data:image\/)/.test(data)) {
    return (
      <Image
        source={{ uri: data }}
        style={{ width: size, height: size }}
        accessibilityLabel="Boarding QR"
      />
    );
  }
  return (
    <View accessibilityLabel="Boarding QR">
      <QRCode
        value={data}
        size={size}
        color={colors.midnight}
        backgroundColor={colors.surface}
        ecl="M"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    backgroundColor: colors.tile,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  emptyText: { ...typography.secondary, color: colors.textMuted, textAlign: 'center' },
});
