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
  Pressable 
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { ownerAuthService } from '../../services/ownerAuthService';
import Toast from 'react-native-toast-message';
import { Smartphone, Store, ShieldCheck, ChevronRight } from 'lucide-react-native';

export const LoginScreen = () => {
  const navigation = useNavigation();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const insets = useSafeAreaInsets();

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
    if (!phone || phone.length < 10) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Number',
        text2: 'Please enter a valid 10-digit phone number.'
      });
      return;
    }

    setLoading(true);
    try {
      await ownerAuthService.sendOtp(phone);
      Toast.show({
        type: 'success',
        text1: 'Code Sent',
        text2: 'Verification code sent to +91 ' + phone
      });
      navigation.navigate('VerifyOTP', { phone });
    } catch (e) {
      console.error('OTP Send Error', e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send OTP.'
      });
    } finally {
      setLoading(false);
    }
  };

  const isButtonEnabled = phone.length === 10 && !loading;

  return (
    <SafeAreaView style={styles.container}>
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
            
            {/* Header row with logo and shop illustration */}
            <View style={[styles.headerContainer, { paddingTop: insets.top > 0 ? insets.top + 8 : 16 }]}>
              <View style={styles.headerTextSection}>
                <View style={styles.logoBox}>
                  <Store color="#16A34A" size={26} strokeWidth={2.5} />
                </View>
                <Text style={styles.welcomeText}>Welcome to</Text>
                <Text style={styles.portalTitle}>Partner Portal</Text>
                <View style={styles.sloganRow}>
                  <Text style={styles.sloganText}>Helping local shops grow</Text>
                  <Text style={styles.heartEmoji}>💚</Text>
                </View>
              </View>

              {/* Styled Shop Illustration */}
              <View style={styles.shopIllustration}>
                {/* Awning/Roof */}
                <View style={styles.awningContainer}>
                  <View style={styles.awning}>
                    <View style={[styles.stripe, { backgroundColor: '#15803D' }]} />
                    <View style={[styles.stripe, { backgroundColor: '#DCFCE7' }]} />
                    <View style={[styles.stripe, { backgroundColor: '#15803D' }]} />
                    <View style={[styles.stripe, { backgroundColor: '#DCFCE7' }]} />
                    <View style={[styles.stripe, { backgroundColor: '#15803D' }]} />
                    <View style={[styles.stripe, { backgroundColor: '#DCFCE7' }]} />
                  </View>
                  {/* Scallops Scalloped Awning Effect */}
                  <View style={styles.scallopsRow}>
                    <View style={[styles.scallop, { backgroundColor: '#15803D' }]} />
                    <View style={[styles.scallop, { backgroundColor: '#DCFCE7' }]} />
                    <View style={[styles.scallop, { backgroundColor: '#15803D' }]} />
                    <View style={[styles.scallop, { backgroundColor: '#DCFCE7' }]} />
                    <View style={[styles.scallop, { backgroundColor: '#15803D' }]} />
                    <View style={[styles.scallop, { backgroundColor: '#DCFCE7' }]} />
                  </View>
                </View>
                {/* Wall */}
                <View style={styles.shopWall}>
                  <View style={styles.shopDoor} />
                  <View style={styles.openBadge}>
                    <Text style={styles.openBadgeText}>OPEN</Text>
                  </View>
                </View>
                {/* Trees/Bushes */}
                <View style={styles.bushLeft} />
                <View style={styles.bushRight} />
              </View>
            </View>

            {/* Input Card Container */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Enter your mobile number</Text>
              <Text style={styles.cardSubtitle}>We'll send a verification code to this number</Text>

              {/* Country Picker & Input Row */}
              <View style={[
                styles.inputRow,
                isFocused && styles.inputRowFocused
              ]}>
                <View style={styles.countryPicker}>
                  <Text style={styles.flagEmoji}>🇮🇳</Text>
                  <Text style={styles.countryCode}>+91</Text>
                  <View style={styles.chevronDown} />
                </View>
                
                <View style={styles.verticalDivider} />

                <TextInput
                  style={styles.textInput}
                  placeholder="Enter mobile number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  multiline={false}
                  numberOfLines={1}
                  value={phone}
                  onChangeText={(val) => setPhone(val.replace(/[^0-9]/g, '').slice(0, 10))}
                  maxLength={10}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />

                <Smartphone color="#16A34A" size={18} style={{ alignSelf: 'center', marginRight: 12 }} />
              </View>

              {/* Security Banner inside Card */}
              <View style={styles.securityBanner}>
                <ShieldCheck color="#16A34A" size={15} style={{ marginRight: 6 }} />
                <Text style={styles.securityBannerText}>Your information is safe and secure</Text>
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
                      <Text style={styles.buttonText}>Continue</Text>
                      <ChevronRight color="#FFF" size={18} strokeWidth={2.5} style={styles.buttonChevron} />
                    </View>
                  )}
                </Animated.View>
              </Pressable>
            </View>

            {/* Legalese Footer Links */}
            <Text style={styles.legaleseText}>
              By continuing, you agree to our{' '}
              <Text 
                style={styles.legaleseLink} 
                onPress={() => Toast.show({ type: 'info', text1: 'Terms & Conditions', text2: 'Open Terms of Service' })}
              >
                Terms & Conditions
              </Text>{' '}
              and{' '}
              <Text 
                style={styles.legaleseLink}
                onPress={() => Toast.show({ type: 'info', text1: 'Privacy Policy', text2: 'Open Privacy documentation' })}
              >
                Privacy Policy
              </Text>
            </Text>

            {/* Version Footer */}
            <View style={styles.footerRow}>
              <Text style={styles.versionText}>v1.0.0</Text>
            </View>

          </Animated.View>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  contentContainer: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerTextSection: {
    flex: 1,
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  portalTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 30,
    marginTop: 2,
  },
  sloganRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  sloganText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  heartEmoji: {
    fontSize: 11,
    marginLeft: 4,
  },
  shopIllustration: {
    width: 100,
    height: 80,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  awningContainer: {
    width: 90,
    height: 22,
    position: 'relative',
    zIndex: 4,
  },
  awning: {
    flexDirection: 'row',
    width: 90,
    height: 16,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    overflow: 'hidden',
  },
  scallopsRow: {
    flexDirection: 'row',
    width: 90,
    height: 6,
    position: 'absolute',
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  scallop: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    marginTop: -7.5,
  },
  stripe: {
    flex: 1,
  },
  shopWall: {
    width: 78,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
    zIndex: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  shopDoor: {
    width: 16,
    height: 25,
    backgroundColor: '#F1F5F9',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    position: 'absolute',
    bottom: 0,
    left: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  openBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#15803D',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  openBadgeText: {
    fontSize: 7,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  bushLeft: {
    position: 'absolute',
    left: -8,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    zIndex: 1,
    opacity: 0.9,
  },
  bushRight: {
    position: 'absolute',
    right: -6,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#BBF7D0',
    zIndex: 1,
    opacity: 0.95,
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
    backgroundColor: '#15803D',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
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
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginLeft: 18,
  },
  buttonChevron: {
    alignSelf: 'center',
  },
  legaleseText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 28,
    paddingHorizontal: 8,
    fontWeight: '500',
  },
  legaleseLink: {
    color: '#15803D',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  footerRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  versionText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
  },
});
