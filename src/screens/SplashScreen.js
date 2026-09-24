import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, StatusBar } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect } from 'react-native-svg';
import BootSplash from 'react-native-bootsplash';
import { theme } from '../theme';
import { PaasoraPartnerLogo, orbitPadding } from '../components/PaasoraPartnerLogo';

const { width, height } = Dimensions.get('window');

// The brand green the logo sits on, so the whole screen reads as the mark.
const BRAND_GREEN = theme.colors.primary;
const SLOGAN = 'Grow where you belong.';

const MARK_WIDTH = Math.min(width * 0.58, 250);
const RULE_WIDTH = 56;
const BAR_TRACK_WIDTH = 140;
const BAR_FILL_WIDTH = 56;

// The orbiting mark reserves room around itself for the dot's lap, which would
// otherwise read as extra space above the rule. Take it back out here.
const MARK_GUTTER = orbitPadding(MARK_WIDTH);

export const SplashScreen = () => {
  const haloOpacity = useSharedValue(0);
  const haloScale = useSharedValue(0.92);
  const markOpacity = useSharedValue(0);
  const markScale = useSharedValue(0.86);
  const markTranslateY = useSharedValue(18);
  const ruleScale = useSharedValue(0);
  const sloganOpacity = useSharedValue(0);
  const sloganTranslateY = useSharedValue(14);
  const barOpacity = useSharedValue(0);
  const barProgress = useSharedValue(0);

  useEffect(() => {
    // Hand off from the native boot splash as soon as this paints.
    try {
      BootSplash.hide({ fade: true }).catch(() => {});
    } catch (e) {}

    // A soft light bloom settles in behind the mark, then breathes slowly so
    // the screen never feels frozen while we wait on session restore.
    haloOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) });
    haloScale.value = withRepeat(
      withTiming(1.08, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    // Lockup rises and settles with a gentle overshoot. The dot inside the `o`
    // runs its own lap — see PaasoraPartnerLogo.
    markOpacity.value = withDelay(120, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
    markTranslateY.value = withDelay(120, withTiming(0, { duration: 620, easing: Easing.out(Easing.cubic) }));
    markScale.value = withDelay(120, withSpring(1, { damping: 14, stiffness: 90, mass: 0.9 }));

    ruleScale.value = withDelay(520, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));

    sloganOpacity.value = withDelay(660, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
    sloganTranslateY.value = withDelay(660, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));

    barOpacity.value = withDelay(900, withTiming(1, { duration: 400 }));
    barProgress.value = withDelay(
      900,
      withRepeat(withTiming(1, { duration: 950, easing: Easing.inOut(Easing.ease) }), -1, true)
    );
  }, [
    haloOpacity,
    haloScale,
    markOpacity,
    markScale,
    markTranslateY,
    ruleScale,
    sloganOpacity,
    sloganTranslateY,
    barOpacity,
    barProgress,
  ]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
    transform: [{ scale: haloScale.value }],
  }));

  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ translateY: markTranslateY.value }, { scale: markScale.value }],
  }));

  const ruleStyle = useAnimatedStyle(() => ({
    opacity: ruleScale.value,
    transform: [{ scaleX: ruleScale.value }],
  }));

  const sloganStyle = useAnimatedStyle(() => ({
    opacity: sloganOpacity.value,
    transform: [{ translateY: sloganTranslateY.value }],
  }));

  const barContainerStyle = useAnimatedStyle(() => ({ opacity: barOpacity.value }));

  const barFillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: barProgress.value * (BAR_TRACK_WIDTH - BAR_FILL_WIDTH) }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_GREEN} />

      {/* Brand green, with a touch of depth top to bottom */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1AAB4F" />
            <Stop offset="0.5" stopColor={BRAND_GREEN} />
            <Stop offset="1" stopColor="#119040" />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#bg)" />
      </Svg>

      {/* Soft bloom behind the mark */}
      <Animated.View style={[StyleSheet.absoluteFill, haloStyle]} pointerEvents="none">
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="46%" rx="62%" ry="42%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.22" />
              <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0.07" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width={width} height={height} fill="url(#halo)" />
        </Svg>
      </Animated.View>

      <View style={styles.content}>
        <Animated.View style={markStyle}>
          {/* accent matches the backdrop, so PARTNER reads as a knockout */}
          <PaasoraPartnerLogo
            width={MARK_WIDTH}
            color="#FFFFFF"
            accent={BRAND_GREEN}
            orbit
            orbitTurns={1}
            orbitDuration={1450}
            orbitDelay={120}
          />
        </Animated.View>

        <Animated.View style={[styles.rule, ruleStyle]} />

        <Animated.Text style={[styles.slogan, sloganStyle]}>{SLOGAN}</Animated.Text>
      </View>

      <Animated.View style={[styles.barTrack, barContainerStyle]}>
        <Animated.View style={[styles.barFill, barFillStyle]} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_GREEN,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rule: {
    width: RULE_WIDTH,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginTop: Math.max(6, 24 - MARK_GUTTER),
    marginBottom: 18,
  },
  slogan: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.92)',
    letterSpacing: 0.6,
  },
  barTrack: {
    position: 'absolute',
    bottom: 72,
    alignSelf: 'center',
    width: BAR_TRACK_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
  },
  barFill: {
    width: BAR_FILL_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
});

export default SplashScreen;
