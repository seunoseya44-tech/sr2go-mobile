/**
 * The SR2Go logo (Martin, 1 Nov): the 3D logo with black R and GO - made for the app's white background (the
 * chrome version is for the website's dark header). The slogan "SHARE THE RIDE REACH TOGETHER." (no dot after
 * RIDE, Martin 1 Nov) is set as text under it when `slogan` is set, so it is never smaller than 13 px.
 * One place for the logo: every page uses this.
 */
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '../theme';

const ASPECT = 1200 / 326; // assets/logo-3d.png (Martin's logo of 1 Nov, without the slogan line)

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
        source={require('../../assets/logo-3d.png')}
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
          <Text style={{ color: onDark ? colors.textOnBrand : colors.midnight }}>
            SHARE THE RIDE{' '}
          </Text>
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
