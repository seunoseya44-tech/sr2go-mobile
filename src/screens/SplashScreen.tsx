import { Image, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button } from '../components/Button';
import type { AuthStackParamList } from '../navigation/types';
import { colors, fonts, spacing, typography } from '../theme';

const LOGO_WIDTH = 260;
const LOGO_ASPECT = 1972 / 605;
/** Clearance above the iOS home indicator asked for in the 8 Oct review. */
const BOTTOM_CLEARANCE = 20;

/**
 * Screen 01 · Welcome (approved 8 Oct 2026 with three fixes).
 *
 * Approved bridge photo full bleed, two white scrims so the dark text keeps
 * AA contrast over the skyline and the road, the full logo with tagline high
 * up, headline, "Get Started" and "Log in" pinned at the bottom, and the trust
 * line as two fixed lines (the hyphen in 24‑48h is non-breaking).
 */
export function SplashScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  return (
    <ImageBackground
      source={require('../../assets/welcome-bg.jpg')}
      resizeMode="cover"
      style={styles.root}
      testID="welcome-screen"
    >
      <StatusBar style="dark" />
      {/* Top scrim: white 100% → 100% at 28% → 80% at 46% → 0% at 60% */}
      <LinearGradient
        pointerEvents="none"
        colors={['#FFFFFF', '#FFFFFF', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0)']}
        locations={[0, 0.28, 0.46, 0.6]}
        style={StyleSheet.absoluteFill}
      />
      {/* Bottom scrim: 0% at 62% → 70% at 78% → 88% at the bottom */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(255,255,255,0)',
          'rgba(255,255,255,0)',
          'rgba(255,255,255,0.7)',
          'rgba(255,255,255,0.88)',
        ]}
        locations={[0, 0.62, 0.78, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: Math.max(insets.top, 24) + 72 }]}>
        <Image
          source={require('../../assets/logo-full.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="SR2Go. Share the ride, reach together."
        />

        <View style={styles.copy}>
          <Text style={styles.headline}>Travel between cities{'\n'}for less.</Text>
          <Text style={styles.sub}>
            Share a ride with verified drivers already{'\n'}going your way.
          </Text>
        </View>

        <View style={styles.flex} />

        <View style={[styles.bottom, { paddingBottom: insets.bottom + BOTTOM_CLEARANCE }]}>
          <Button
            title="Get Started"
            onPress={() => navigation.navigate('CreateAccount')}
            testID="get-started"
          />
          <Button
            title="Log in"
            variant="light"
            onPress={() => navigation.navigate('Login')}
            style={styles.login}
            testID="welcome-login"
          />
          <Text style={styles.trust} testID="trust-line">
            NIN/BVN-verified drivers · QR boarding{'\n'}Payment held 24‑48h
          </Text>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: spacing.xl },
  logo: { width: LOGO_WIDTH, height: LOGO_WIDTH / LOGO_ASPECT, alignSelf: 'center' },
  copy: { marginTop: 36, gap: spacing.md, alignItems: 'center' },
  headline: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.midnight,
    textAlign: 'center',
  },
  sub: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  bottom: { gap: spacing.sm },
  login: { borderWidth: 1, borderColor: colors.border },
  trust: {
    ...typography.label,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
});
