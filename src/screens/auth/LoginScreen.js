import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Animated,
  Pressable,
  StatusBar,
  Alert,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Pattern, Mask, Stop, Rect, Circle } from 'react-native-svg';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { ownerAuthService } from '../../services/ownerAuthService';
import Toast from 'react-native-toast-message';
import { Smartphone, ShieldCheck, ChevronRight, ArrowRight, Lock } from 'lucide-react-native';
import { PaasoraPartnerTile } from '../../components/PaasoraPartnerLogo';
import { useTranslation } from '../../constants/translations';

// Decorative backdrop: mint wash fading to white, two soft brand-green glows
// and a dot grid that dissolves before it reaches the card.
const LoginBackdrop = () => {
  const { width, height } = useWindowDimensions();
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#DCFCE7" />
          <Stop offset="0.45" stopColor="#F0FDF4" />
          <Stop offset="1" stopColor="#FFFFFF" />
        </LinearGradient>
        <RadialGradient id="glowTop" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#22C55E" stopOpacity="0.28" />
          <Stop offset="1" stopColor="#22C55E" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="glowBottom" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#10B981" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#10B981" stopOpacity="0" />
        </RadialGradient>
        <Pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
          <Circle cx="2" cy="2" r="1.3" fill="#16A34A" fillOpacity="0.14" />
        </Pattern>
        <LinearGradient id="dotFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
        <Mask id="dotMask">
          <Rect width={width} height={height * 0.45} fill="url(#dotFade)" />
        </Mask>
      </Defs>
      <Rect width={width} height={height} fill="url(#wash)" />
      <Rect width={width} height={height} fill="url(#dots)" mask="url(#dotMask)" />
      <Circle cx={width * 0.95} cy={height * 0.06} r={width * 0.6} fill="url(#glowTop)" />
      <Circle cx={width * 0.02} cy={height * 0.92} r={width * 0.7} fill="url(#glowBottom)" />
    </Svg>
  );
};

export const LoginScreen = () => {
  const navigation = useNavigation();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scaleBtn = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.timing(scaleBtn, { toValue: 0.96, duration: 100, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleBtn, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  };

  const handleSendOtp = async () => {
    // One field, so there is nothing to scroll to — but the message belongs
    // under the input rather than in a toast that slides away.
    if (!phone || phone.length < 10) {
      setPhoneError(t('phoneTenDigits', 'Enter your 10-digit mobile number.'));
      return;
    }
    setPhoneError('');

    setLoading(true);
    try {
      const res = await ownerAuthService.sendOtp(phone);
      navigation.navigate('VerifyOTP', {
        phone,
        resendInSec: res?.resend_in_sec,
        devMode: !!res?.dev_mode,
      });
    } catch (e) {
      if (e.code === 'ACCOUNT_DELETION_PENDING') {
        // Too long for a toast, and it is the whole answer to "why can't I
        // sign in" — the server refuses a locked account.
        Alert.alert(t('delPendingTitle', 'Account unavailable'), t('delPendingLogin', e.message));
        return;
      }
      Toast.show({
        type: 'error',
        text1: e.isThrottled ? 'Too many attempts' : 'Error',
        // The backend message says how long to wait: 25s after a resend,
        // an hour once the hourly send limit is hit.
        text2: e.message || 'Failed to send OTP.',
      });
    } finally {
      setLoading(false);
    }
  };

  const isButtonEnabled = phone.length === 10 && !loading;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#DCFCE7" />
      <LoginBackdrop />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <KeyboardAwareScrollView
          contentContainerStyle={styles.keyboardView}
          enableOnAndroid={true}
          enableAutomaticScroll={true}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[
            styles.contentContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}>

            {/* Header section matching reference screen design */}
            <View style={[styles.headerContainer, { paddingTop: Platform.OS === 'ios' ? insets.top + 16 : Math.max(insets.top, StatusBar.currentHeight || 24) + 16 }]}>
              {/* Brand tile — the app-icon artwork, white lockup on brand green */}
              <View style={styles.logoBadgeContainer}>
                <PaasoraPartnerTile size={136} background={theme.colors.primary} style={styles.logoTile} />
              </View>

              {/* Title & Subtitle */}
              <Text style={styles.welcomeText}>{t('loginTitle', 'Welcome to Paasora Partner')}</Text>
              <Text style={styles.subheadText}>{t('loginSubtitle', 'Manage your shop, orders and payments in one place.')}</Text>
            </View>

            {/* Input Card Container (Kept as requested) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('enterMobileNumber', 'Enter your mobile number')}</Text>
              <Text style={styles.cardSubtitle}>{t('verificationCodeNotice', "We'll send a verification code to this number")}</Text>

              {/* Country Picker & Input Row */}
              <View style={[
                styles.inputRow,
                isFocused && styles.inputRowFocused,
                !!phoneError && styles.inputRowError
              ]}>
                <View style={styles.countryPicker}>
                  <Text style={styles.flagEmoji}>🇮🇳</Text>
                  <Text style={styles.countryCode}>+91</Text>
                  <View style={styles.chevronDown} />
                </View>

                <View style={styles.verticalDivider} />

                <TextInput
                  style={styles.textInput}
                  placeholder={t('mobilePlaceholder', 'Enter mobile number')}
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  multiline={false}
                  numberOfLines={1}
                  value={phone}
                  onChangeText={(val) => {
                    setPhone(val.replace(/[^0-9]/g, '').slice(0, 10));
                    if (phoneError) setPhoneError('');
                  }}
                  maxLength={10}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />

                <Smartphone color="#16A34A" size={18} style={{ alignSelf: 'center', marginRight: 12 }} />
              </View>

              {!!phoneError && <Text style={styles.fieldErrorText}>{phoneError}</Text>}

              {/* Security Banner inside Card */}
              <View style={styles.securityBanner}>
                <ShieldCheck color="#16A34A" size={15} style={{ marginRight: 6 }} />
                <Text style={styles.securityBannerText}>{t('safeAndSecure', 'Your information is safe and secure')}</Text>
              </View>

              {/* Primary Button */}
              <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handleSendOtp}
                disabled={!isButtonEnabled}
              >
                <Animated.View style={[
                  styles.button,
                  !isButtonEnabled && styles.buttonDisabled,
                  { transform: [{ scale: scaleBtn }] }
                ]}>
                  {loading ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <View style={styles.buttonInner}>
                      <Text style={styles.buttonText}>{t('continueBtn', 'Continue')}</Text>
                      <ArrowRight color="#FFF" size={20} strokeWidth={2.5} style={styles.buttonChevron} />
                    </View>
                  )}
                </Animated.View>
              </Pressable>
            </View>

            {/* Legalese Footer Links */}
            <View style={styles.legaleseContainer}>
              <Lock color="#64748B" size={16} style={{ marginRight: 6, marginTop: 1 }} />
              <Text style={styles.legaleseText}>
                {t('legalPrefix')}{' '}
                <Text
                  style={styles.legaleseLink}
                  onPress={() => Toast.show({ type: 'info', text1: t('termsConditions'), text2: t('openTermsOfService') })}
                >
                  {t('termsOfService')}
                </Text>{' '}
                {t('legalAnd')}{' '}
                <Text
                  style={styles.legaleseLink}
                  onPress={() => Toast.show({ type: 'info', text1: t('privacyPolicyLabel'), text2: t('openPrivacyDocs') })}
                >
                  {t('privacyPolicyLabel')}
                </Text>
              </Text>
            </View>

          </Animated.View>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  inputRowError: {
    borderColor: '#DC2626',
    borderWidth: 1.5,
  },
  fieldErrorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 8,
    marginBottom: 2,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: 'center',
  },
  contentContainer: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 28,
  },
  logoBadgeContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoTile: {
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  subheadText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.12)',
    shadowColor: '#14532D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    height: 50,
    marginTop: 16,
    overflow: 'hidden',
  },
  inputRowFocused: {
    borderColor: '#16A34A',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
  },
  flagEmoji: {
    fontSize: 16,
    marginRight: 5,
  },
  countryCode: {
    fontSize: 14,
    fontWeight: '750',
    color: '#0F172A',
    marginRight: 4,
  },
  chevronDown: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#64748B',
    marginLeft: 2,
    marginTop: 2,
  },
  verticalDivider: {
    width: 1.2,
    backgroundColor: '#E2E8F0',
  },
  textInput: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  securityBannerText: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#16A34A',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginLeft: 20,
  },
  buttonChevron: {
    alignSelf: 'center',
  },
  legaleseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  legaleseText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  legaleseLink: {
    color: '#16A34A',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
