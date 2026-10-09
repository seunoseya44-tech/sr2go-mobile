import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View } from 'react-native';

import { colors } from '../theme';

const MARK_WIDTH = 200;
const MARK_ASPECT = 1969 / 529;
const DASHES = 9;

/**
 * Animated logo shown once at launch, between the native splash (which has the
 * same mark on white, so the hand-off is seamless) and the first screen.
 *
 * Sequence (about 1.6 s): the mark settles in with a gentle scale and fade,
 * the dashed road line draws itself left to right underneath, a short hold,
 * then the whole thing fades out and `onDone` fires. Skipped entirely when
 * the user has "reduce motion" on.
 */
export function BrandIntro({ onDone }: { onDone: () => void }) {
  // Lazy state keeps the Animated values stable across renders without
  // reading a ref during render.
  const [mark] = useState(() => new Animated.Value(0));
  const [dashes] = useState(() => Array.from({ length: DASHES }, () => new Animated.Value(0)));
  const [fade] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const done = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => !cancelled && setReduceMotion(v))
      .catch(() => !cancelled && setReduceMotion(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;
    const finish = () => {
      if (done.current) return;
      done.current = true;
      onDone();
    };
    if (reduceMotion) {
      finish();
      return;
    }
    const anim = Animated.sequence([
      Animated.timing(mark, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.stagger(
        45,
        dashes.map((d) =>
          Animated.timing(d, {
            toValue: 1,
            duration: 160,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ),
      ),
      Animated.delay(420),
      Animated.timing(fade, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    anim.start(({ finished }) => finished && finish());
    // Safety net: never trap the user on the intro if an animation is interrupted.
    const guard = setTimeout(finish, 2600);
    return () => {
      clearTimeout(guard);
      anim.stop();
    };
  }, [reduceMotion, mark, dashes, fade, onDone]);

  if (reduceMotion === null || reduceMotion) return <View style={styles.root} />;

  return (
    <Animated.View style={[styles.root, { opacity: fade }]} testID="brand-intro">
      <Animated.View
        style={{
          opacity: mark,
          transform: [{ scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }],
        }}
      >
        <Image
          source={require('../../assets/logo-mark.png')}
          style={styles.mark}
          resizeMode="contain"
        />
      </Animated.View>
      <View style={styles.road} accessible={false}>
        {dashes.map((d, i) => (
          <Animated.View
            key={i}
            style={[styles.dash, { opacity: d, transform: [{ scaleX: d }] }]}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { width: MARK_WIDTH, height: MARK_WIDTH / MARK_ASPECT },
  road: { flexDirection: 'row', gap: 8, marginTop: 22 },
  dash: { width: 14, height: 3, borderRadius: 2, backgroundColor: colors.brand },
});
