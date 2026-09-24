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
  StatusBar
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { ownerAuthService } from '../../services/ownerAuthService';
import Toast from 'react-native-toast-message';
import { Smartphone, Store, ShieldCheck, ChevronRight, MapPin, ArrowRight, Lock } from 'lucide-react-native';
import { useTranslation } from '../../constants/translations';

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
      });
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: e.isThrottled ? 'Too many attempts' : 'Error',
        text2: e.isThrottled
          ? `Please wait ${ownerAuthService.getRetryAfterSeconds(e) || 60}s before trying again.`
          : e.message || 'Failed to send OTP.',
      });
    } finally {
      setLoading(false);
    }
  };

  const isButtonEnabled = phone.length === 10 && !loading;

  return (
    <View style={styles.container}>
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
              {/* Location Pin Logo with Store icon */}
              <View style={styles.logoBadgeContainer}>
                <View style={styles.pinIconWrapper}>
                  <MapPin color="#16A34A" size={92} fill="#ECFDF5" strokeWidth={1.8} />
                  <View style={styles.pinStoreIcon}>
                    <Store color="#16A34A" size={32} strokeWidth={2.4} />
                  </View>
                </View>
                <Text style={styles.brandTitleText}>
                  Near<Text style={styles.brandTitleHighlight}>Kart</Text>
                </Text>
              </View>

              {/* Title & Subtitle */}
              <Text style={styles.welcomeText}>{t('loginTitle', 'Welcome to NearKart')}</Text>
              <Text style={styles.subheadText}>{t('loginSubtitle', 'Shop from your trusted nearby stores.')}</Text>
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
  pinIconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinStoreIcon: {
    position: 'absolute',
    top: 22,
  },
  brandTitleText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 8,
    letterSpacing: -0.5,
  },
  brandTitleHighlight: {
    color: '#16A34A',
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
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 3,
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
