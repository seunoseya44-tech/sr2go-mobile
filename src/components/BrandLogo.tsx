/**
 * The SR2Go logo (1 Nov, Martin): the chrome 3D logo of the website header (logo_10.png), with the slogan
 * "SHARE THE RIDE  REACH TOGETHER." under it when `slogan` is set. One place for the logo in the app:
 * Home header, welcome screen and the brand intro all use this.
 */
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '../theme';

const ASPECT = 899 / 249; // assets/logo-chrome.png (trimmed website logo)

export function BrandLogo({
  width,
  slogan = false,
  onDark = false,
  style,
}: {
  width: number;
  slogan?: boolean;
  /** Slogan in white instead of midnight, for a dark background. */
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const sloganSize = Math.max(13, Math.round(width / 21)); // never below the 13 px minimum
  return (
    <View style={[styles.wrap, style]}>
      <Image
        source={require('../../assets/logo-chrome.png')}
        style={{ width, height: width / ASPECT }}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel={slogan ? 'SR2Go. Share the ride, reach together.' : 'SR2Go'}
      />
      {slogan ? (
        <Text
          style={[styles.slogan, { fontSize: sloganSize, lineHeight: sloganSize + 4 }]}
          numberOfLines={1}
          accessible={false}
        >
          <Text style={{ color: onDark ? colors.textOnBrand : colors.midnight }}>SHARE THE RIDE </Text>
          <Text style={{ color: colors.brand }}>REACH TOGETHER.</Text>
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  slogan: { fontFamily: fonts.bold, letterSpacing: 1.2, marginTop: 4 },
});
