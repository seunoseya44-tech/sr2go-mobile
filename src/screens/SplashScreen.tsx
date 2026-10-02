import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { BrandMark } from '../components/BrandMark';
import { Button } from '../components/Button';
import { env } from '../config/env';
import type { AuthStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';

/** Screen 01: full-bleed Primary Blue welcome. */
export function SplashScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <StatusBar style="light" />
      <RoadCurves />
      <View style={styles.logo}>
        <BrandMark />
      </View>

      <View style={styles.body}>
        <Text style={styles.headline}>Travel between{'\n'}cities for less.</Text>
        <Text style={styles.sub}>Share a ride with verified drivers already going your way.</Text>
        <Pressable
          style={styles.pill}
          onPress={() => Linking.openURL(`${env.websiteUrl}/#how-it-works`)}
          accessibilityRole="link"
        >
          <Text style={styles.pillText}>See how it works</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textOnBrand} />
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Button
          title="Log in"
          variant="outlineLight"
          onPress={() => navigation.navigate('Login')}
          style={styles.half}
          testID="splash-login"
        />
        <Button
          title="Sign up"
          variant="light"
          onPress={() => navigation.navigate('CreateAccount')}
          style={styles.half}
          testID="splash-signup"
        />
      </View>
      <Text style={styles.trust}>NIN/BVN-verified drivers · QR boarding · Payment held 24–48h</Text>
    </View>
  );
}

/** Faint white dashed curves, the logo's road-line motif as background. */
function RoadCurves() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[0.18, 0.42, 0.66].map((top, i) => (
        <View
          key={i}
          style={[
            styles.curve,
            { top: `${top * 100}%`, transform: [{ rotate: `${-18 + i * 8}deg` }] },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  curve: {
    position: 'absolute',
    left: -80,
    right: -80,
    height: 140,
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  logo: { alignItems: 'center' },
  body: { flex: 1, justifyContent: 'flex-end', gap: spacing.md, paddingBottom: spacing.lg },
  headline: { ...typography.display, color: colors.textOnBrand },
  sub: { ...typography.body, color: 'rgba(255,255,255,0.92)', maxWidth: 320 },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    minHeight: 40,
  },
  pillText: { ...typography.bodyMedium, fontSize: 14, color: colors.textOnBrand },
  actions: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  trust: {
    ...typography.label,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
});
