import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, G, Circle, Rect, Mask, Defs, RadialGradient, Stop } from 'react-native-svg';

/**
 * The Paasora Partner lockup, drawn as vector paths — no font dependency and
 * no raster asset, so it stays crisp at any size and can be re-tinted.
 *
 * The letterforms are Poppins Bold outlines (OFL). The `o` is custom: the ring
 * carries a circular bite with the accent dot floating inside it. The PARTNER
 * pill sits below at the proportions taken from the brand artwork.
 *
 * Two colours: `color` paints the wordmark and the pill, `accent` paints the
 * PARTNER text, so it has to match whatever sits behind the lockup.
 *
 * The viewBox starts at 0,0 on purpose — react-native-svg does not apply a
 * negative viewBox origin reliably, which pushes the mark out of its box.
 */

const INK_W = 4143;
const INK_H = 832;          // the wordmark alone
const LOCKUP_H = 1666.8145;  // wordmark + gap + pill
const ASPECT = 2.4856;

const LETTERS = 'M343 0Q412 0 468.0 35.0Q524 70 556.5 135.0Q589 200 589 286Q589 372 556.5 437.5Q524 503 468.0 538.5Q412 574 343 574Q285 574 240.5 550.0Q196 526 171 488V832H0V8H171V87Q196 48 240.0 24.0Q284 0 343 0ZM292 149Q241 149 205.5 186.0Q170 223 170 287Q170 351 205.5 388.0Q241 425 292 425Q343 425 379.0 387.5Q415 350 415 286Q415 222 379.5 185.5Q344 149 292 149ZM879 0Q938 0 982.5 24.0Q1027 48 1051 87V8H1222V566H1051V487Q1026 526 981.5 550.0Q937 574 878 574Q810 574 754.0 538.5Q698 503 665.5 437.5Q633 372 633 286Q633 200 665.5 135.0Q698 70 754.0 35.0Q810 0 879 0ZM929 149Q878 149 842.5 185.5Q807 222 807 286Q807 350 842.5 387.5Q878 425 929 425Q980 425 1015.5 388.0Q1051 351 1051 287Q1051 223 1015.5 186.0Q980 149 929 149ZM1546 0Q1605 0 1649.5 24.0Q1694 48 1718 87V8H1889V566H1718V487Q1693 526 1648.5 550.0Q1604 574 1545 574Q1477 574 1421.0 538.5Q1365 503 1332.5 437.5Q1300 372 1300 286Q1300 200 1332.5 135.0Q1365 70 1421.0 35.0Q1477 0 1546 0ZM1596 149Q1545 149 1509.5 185.5Q1474 222 1474 286Q1474 350 1509.5 387.5Q1545 425 1596 425Q1647 425 1682.5 388.0Q1718 351 1718 287Q1718 223 1682.5 186.0Q1647 149 1596 149ZM1971 383H2140Q2143 412 2167.0 430.0Q2191 448 2226 448Q2258 448 2275.5 435.5Q2293 423 2293 403Q2293 379 2268.0 367.5Q2243 356 2187 342Q2127 328 2087.0 312.5Q2047 297 2018.0 263.5Q1989 230 1989 173Q1989 125 2015.5 85.5Q2042 46 2093.5 23.0Q2145 0 2216 0Q2321 0 2381.5 52.0Q2442 104 2451 190H2293Q2289 161 2267.5 144.0Q2246 127 2211 127Q2181 127 2165.0 138.5Q2149 150 2149 170Q2149 194 2174.5 206.0Q2200 218 2254 230Q2316 246 2355.0 261.5Q2394 277 2423.5 311.5Q2453 346 2454 404Q2454 453 2426.5 491.5Q2399 530 2347.5 552.0Q2296 574 2228 574Q2155 574 2098.0 549.0Q2041 524 2008.0 480.5Q1975 437 1971 383ZM3518 2V183H3471Q3407 183 3375.0 210.5Q3343 238 3343 307V566H3172V8H3343V101Q3373 55 3418.0 28.5Q3463 2 3518 2ZM3800 0Q3859 0 3903.5 24.0Q3948 48 3972 87V8H4143V566H3972V487Q3947 526 3902.5 550.0Q3858 574 3799 574Q3731 574 3675.0 538.5Q3619 503 3586.5 437.5Q3554 372 3554 286Q3554 200 3586.5 135.0Q3619 70 3675.0 35.0Q3731 0 3800 0ZM3850 149Q3799 149 3763.5 185.5Q3728 222 3728 286Q3728 350 3763.5 387.5Q3799 425 3850 425Q3901 425 3936.5 388.0Q3972 351 3972 287Q3972 223 3936.5 186.0Q3901 149 3850 149Z';
const RING = 'M2513 287Q2513 201 2551.0 135.5Q2589 70 2655.0 35.0Q2721 0 2803 0Q2885 0 2951.0 35.0Q3017 70 3055.0 135.5Q3093 201 3093 287Q3093 373 3054.5 438.5Q3016 504 2949.5 539.0Q2883 574 2801 574Q2719 574 2653.5 539.0Q2588 504 2550.5 439.0Q2513 374 2513 287ZM2919 287Q2919 220 2885.5 184.0Q2852 148 2803 148Q2753 148 2720.0 183.5Q2687 219 2687 287Q2687 354 2719.5 390.0Q2752 426 2801 426Q2850 426 2884.5 390.0Q2919 354 2919 287Z';
const RING_NOTCHED = 'M2513 287Q2513 201 2551.0 135.5Q2589 70 2655.0 35.0Q2721 0 2803 0Q2885 0 2951.0 35.0Q3017 70 3055.0 135.5Q3093 201 3093 287Q3093 373 3054.5 438.5Q3016 504 2949.5 539.0Q2883 574 2801 574Q2719 574 2653.5 539.0Q2588 504 2550.5 439.0Q2513 374 2513 287ZM2919 287Q2919 220 2885.5 184.0Q2852 148 2803 148Q2753 148 2720.0 183.5Q2687 219 2687 287Q2687 354 2719.5 390.0Q2752 426 2801 426Q2850 426 2884.5 390.0Q2919 354 2919 287ZM2900.8,94.8a63.4,63.4 0 1,0 126.8,0a63.4,63.4 0 1,0 -126.8,0Z';
const DOT_PATH = 'M2925.1,94.8a39.2,39.2 0 1,0 78.3,0a39.2,39.2 0 1,0 -78.3,0Z';
const PARTNER = 'M1473.100065319149 1366.740535957447H1442.6393189361702V1439.1566500000001H1393.4998129787234V1237.4260465957448H1473.100065319149Q1497.2387700000002 1237.4260465957448 1513.905970851064 1245.7596470212766Q1530.5731717021276 1254.0932474468086 1538.9067721276597 1268.7488895744682Q1547.2403725531915 1283.4045317021278 1547.2403725531915 1302.3706568085108Q1547.2403725531915 1319.8999542553192 1539.1941376595746 1334.4119136170214Q1531.1479027659575 1348.9238729787235 1514.4807019148936 1357.8322044680854Q1497.8135010638298 1366.740535957447 1473.100065319149 1366.740535957447ZM1497.2387700000002 1302.3706568085108Q1497.2387700000002 1290.3013044680852 1490.3419972340425 1283.6918972340427Q1483.4452244680851 1277.0824900000002 1469.3643134042554 1277.0824900000002H1442.6393189361702V1327.6588236170214H1469.3643134042554Q1483.4452244680851 1327.6588236170214 1490.3419972340425 1321.049416382979Q1497.2387700000002 1314.4400091489363 1497.2387700000002 1302.3706568085108ZM1712.4626248936172 1403.5233240425532H1637.172855531915L1625.1035031914894 1439.1566500000001H1573.6650729787234L1646.6559180851066 1237.4260465957448H1703.5542934042555L1776.5451385106385 1439.1566500000001H1724.5319772340426ZM1699.818541489362 1365.5910738297873 1674.817740212766 1291.7381321276598 1650.1043044680853 1365.5910738297873ZM1915.6171274468084 1439.1566500000001 1873.661759787234 1363.0047840425534H1861.8797729787232V1439.1566500000001H1812.7402670212764V1237.4260465957448H1895.2141746808509Q1919.065513829787 1237.4260465957448 1935.8763974468084 1245.7596470212766Q1952.6872810638297 1254.0932474468086 1961.0208814893617 1268.6052068085107Q1969.3544819148935 1283.1171661702128 1969.3544819148935 1300.9338291489362Q1969.3544819148935 1321.049416382979 1958.0035434042552 1336.854520638298Q1946.6526048936169 1352.659624893617 1924.52545893617 1359.2690321276598L1971.078675106383 1439.1566500000001ZM1861.8797729787232 1328.2335546808513H1892.340519361702Q1905.846699361702 1328.2335546808513 1912.5997893617018 1321.6241474468088Q1919.352879361702 1315.0147402127661 1919.352879361702 1302.9453878723405Q1919.352879361702 1291.4507665957449 1912.5997893617018 1284.8413593617024Q1905.846699361702 1278.2319521276597 1892.340519361702 1278.2319521276597H1861.8797729787232ZM2159.29017 1237.4260465957448V1276.7951244680853H2105.8401810638297V1439.1566500000001H2056.700675106383V1276.7951244680853H2003.2506861702127V1237.4260465957448ZM2378.537142340426 1439.1566500000001H2329.397636382979L2247.2110942553195 1314.7273746808512V1439.1566500000001H2198.0715882978725V1237.4260465957448H2247.2110942553195L2329.397636382979 1362.4300529787236V1237.4260465957448H2378.537142340426ZM2477.3779568085106 1276.7951244680853V1317.60103H2543.184663617021V1355.5332802127662H2477.3779568085106V1399.7875721276596H2551.8056295744677V1439.1566500000001H2428.2384508510636V1237.4260465957448H2551.8056295744677V1276.7951244680853ZM2700.6480465957447 1439.1566500000001 2658.6926789361705 1363.0047840425534H2646.91069212766V1439.1566500000001H2597.771186170213V1237.4260465957448H2680.2450938297875Q2704.0964329787234 1237.4260465957448 2720.9073165957448 1245.7596470212766Q2737.718200212766 1254.0932474468086 2746.051800638298 1268.6052068085107Q2754.3854010638297 1283.1171661702128 2754.3854010638297 1300.9338291489362Q2754.3854010638297 1321.049416382979 2743.0344625531916 1336.854520638298Q2731.6835240425535 1352.659624893617 2709.5563780851066 1359.2690321276598L2756.1095942553193 1439.1566500000001ZM2646.91069212766 1328.2335546808513H2677.371438510638Q2690.8776185106385 1328.2335546808513 2697.630708510638 1321.6241474468088Q2704.3837985106384 1315.0147402127661 2704.3837985106384 1302.9453878723405Q2704.3837985106384 1291.4507665957449 2697.630708510638 1284.8413593617024Q2690.8776185106385 1278.2319521276597 2677.371438510638 1278.2319521276597H2646.91069212766Z';

const PILL = { x: 838.1, y: 1008.9, w: 2466.7, h: 657.9, r: 329.0 };

export const MARK_GEOMETRY = {
  viewBoxWidth: INK_W,
  viewBoxHeight: LOCKUP_H,
  o: { cx: 2803.0, cy: 287.0, r: 290.0 },
  dot: { cx: 2964.2, cy: 94.8, r: 39.2 },
  notch: { r: 63.4 },
};

/** The lap the dot runs: a stadium hugging the whole lockup, pill included. */
const LAP = {
  top: -150.0, bot: 1816.8, cyMid: 833.4, capR: 983.4,
  leftX: 833.4, rightX: 3309.6, straight: 2476.2,
  perimeter: 11131.3, entryS: 2130.8,
};

const PAD = 292.5;

/** Extra px reserved around the ink while orbiting, for callers' spacing. */
export const orbitPadding = (width) => PAD * (width / INK_W);

const DEPART_AT = 0.1;
const RETURN_AT = 0.9;

function lapPoint(s) {
  'worklet';
  const arc = Math.PI * LAP.capR;
  let dd = s % LAP.perimeter;
  if (dd < 0) dd += LAP.perimeter;
  if (dd < LAP.straight) return { cx: LAP.leftX + dd, cy: LAP.top };
  dd -= LAP.straight;
  if (dd < arc) {
    const a = dd / LAP.capR - Math.PI / 2;
    return { cx: LAP.rightX + LAP.capR * Math.cos(a), cy: LAP.cyMid + LAP.capR * Math.sin(a) };
  }
  dd -= arc;
  if (dd < LAP.straight) return { cx: LAP.rightX - dd, cy: LAP.bot };
  dd -= LAP.straight;
  const a = dd / LAP.capR + Math.PI / 2;
  return { cx: LAP.leftX + LAP.capR * Math.cos(a), cy: LAP.cyMid + LAP.capR * Math.sin(a) };
}

function dotPoint(p, turns) {
  'worklet';
  const home = MARK_GEOMETRY.dot;
  if (p <= 0) return { cx: home.cx, cy: home.cy };
  if (p < DEPART_AT) {
    const t = p / DEPART_AT;
    return { cx: home.cx, cy: home.cy + (LAP.top - home.cy) * t };
  }
  if (p < RETURN_AT) {
    const t = (p - DEPART_AT) / (RETURN_AT - DEPART_AT);
    return lapPoint(LAP.entryS + t * turns * LAP.perimeter);
  }
  const t = (p - RETURN_AT) / (1 - RETURN_AT);
  return { cx: home.cx, cy: LAP.top + (home.cy - LAP.top) * t };
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * With `orbit`, the accent dot lifts out of its notch, runs `orbitTurns` whole
 * laps around the outside of the lockup, and drops back into the notch — the
 * logo's own resting position — so the animation ends on the mark exactly as
 * drawn. The bite in the ring is a mask circle pinned to the dot, so the `o`
 * heals while the dot is away and re-forms when it lands.
 *
 * Timing budget: at rest by about `orbitDelay + orbitDuration + 230ms`.
 *
 * Note: while orbiting the component reserves room around the lockup for the
 * dot's path, so it lays out larger than `width`; the ink still renders at
 * exactly `width`.
 */
export const PaasoraPartnerLogo = ({
  width = 240,
  color = '#FFFFFF',
  accent = '#16A34A',
  showDot = true,
  orbit = false,
  orbitTurns = 1,
  orbitDuration = 1450,
  orbitDelay = 120,
  glow = true,
  style,
}) => {
  const progress = useSharedValue(0);
  const pulse = useSharedValue(1);
  const animate = orbit && showDot;
  const turns = Math.max(1, Math.round(orbitTurns));

  useEffect(() => {
    if (!animate) return undefined;
    const departMs = Math.round(orbitDuration * 0.14);
    const returnMs = Math.round(orbitDuration * 0.17);
    const lapMs = Math.max(400, orbitDuration - departMs - returnMs);

    progress.value = 0;
    pulse.value = 1;
    progress.value = withDelay(
      orbitDelay,
      withSequence(
        withTiming(DEPART_AT, { duration: departMs, easing: Easing.in(Easing.cubic) }),
        withTiming(RETURN_AT, { duration: lapMs, easing: Easing.linear }),
        withTiming(0.96, { duration: returnMs, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 14, stiffness: 110, mass: 0.8 })
      )
    );
    pulse.value = withDelay(
      orbitDelay + departMs + lapMs + returnMs,
      withSequence(
        withTiming(1.18, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) })
      )
    );
    return () => {
      cancelAnimation(progress);
      cancelAnimation(pulse);
    };
  }, [animate, turns, orbitDuration, orbitDelay, progress, pulse]);

  const notchProps = useAnimatedProps(() => ({
    ...dotPoint(progress.value, turns),
    r: MARK_GEOMETRY.notch.r * pulse.value,
  }));
  const glowProps = useAnimatedProps(() => ({
    ...dotPoint(progress.value, turns),
    r: MARK_GEOMETRY.dot.r * 3 * pulse.value,
  }));
  const dotProps = useAnimatedProps(() => ({
    ...dotPoint(progress.value, turns),
    r: MARK_GEOMETRY.dot.r * pulse.value,
  }));

  const pad = animate ? PAD : 0;
  const vbW = INK_W + pad * 2;
  const vbH = LOCKUP_H + pad * 2;
  const unit = width / INK_W;

  return (
    <Svg
      width={vbW * unit}
      height={vbH * unit}
      viewBox={`${-pad} ${-pad} ${vbW} ${vbH}`}
      style={style}
    >
      {animate ? (
        <Defs>
          <RadialGradient id="partnerDotGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity="0.5" />
            <Stop offset="0.45" stopColor={color} stopOpacity="0.16" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
          <Mask id="partnerNotch" maskUnits="userSpaceOnUse" x={-pad} y={-pad} width={vbW} height={vbH}>
            <Rect x={-pad} y={-pad} width={vbW} height={vbH} fill="#FFFFFF" />
            <AnimatedCircle
              animatedProps={notchProps}
              cx={MARK_GEOMETRY.dot.cx}
              cy={MARK_GEOMETRY.dot.cy}
              r={MARK_GEOMETRY.notch.r}
              fill="#000000"
            />
          </Mask>
        </Defs>
      ) : null}

      <G fill={color}>
        <Path d={LETTERS} />
        {animate ? (
          <>
            <Path d={RING} fillRule="evenodd" mask="url(#partnerNotch)" />
            {glow ? (
              <AnimatedCircle
                animatedProps={glowProps}
                cx={MARK_GEOMETRY.dot.cx}
                cy={MARK_GEOMETRY.dot.cy}
                r={MARK_GEOMETRY.dot.r * 3}
                fill="url(#partnerDotGlow)"
              />
            ) : null}
            <AnimatedCircle
              animatedProps={dotProps}
              cx={MARK_GEOMETRY.dot.cx}
              cy={MARK_GEOMETRY.dot.cy}
              r={MARK_GEOMETRY.dot.r}
              fill={color}
            />
          </>
        ) : (
          <>
            <Path d={showDot ? RING_NOTCHED : RING} fillRule="evenodd" />
            {showDot ? <Path d={DOT_PATH} /> : null}
          </>
        )}
      </G>

      {/* PARTNER pill — reads as a knockout, so the text takes the backdrop colour */}
      <Rect x={PILL.x} y={PILL.y} width={PILL.w} height={PILL.h} rx={PILL.r} ry={PILL.r} fill={color} />
      <Path d={PARTNER} fill={accent} />
    </Svg>
  );
};

/** The square lockup on brand green, matching the app-icon artwork. */
export const PaasoraPartnerTile = ({
  size = 120,
  radius = size * 0.28,
  background = '#16A34A',
  color = '#FFFFFF',
  style,
  ...markProps
}) => (
  <View
    style={[
      {
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      },
      style,
    ]}
  >
    <PaasoraPartnerLogo width={size * 0.645} color={color} accent={background} {...markProps} />
  </View>
);

export default PaasoraPartnerLogo;
