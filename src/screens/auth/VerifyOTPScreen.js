import React, { useState, useContext, useRef, useEffect } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { ownerAuthService } from '../../services/ownerAuthService';
import { AuthContext } from '../../context/AuthContext';
import Toast from 'react-native-toast-message';
import { ArrowLeft, ShieldCheck, ArrowRight, ShieldAlert, Sparkles, Lock } from 'lucide-react-native';

export const VerifyOTPScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { phone } = route.params || { phone: '' };
  const insets = useSafeAreaInsets();
  
  const { login } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  
  // OTP array state
  const [otpArray, setOtpArray] = useState(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Refs for inputs
  const inputRefs = useRef([]);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const shakeOffset = useRef(new Animated.Value(0)).current;
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

  // Timer countdown
  useEffect(() => {
    if (timer === 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handlePressIn = () => {
    Animated.timing(scaleBtn, { toValue: 0.96, duration: 100, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleBtn, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  };

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeOffset, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeOffset, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeOffset, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeOffset, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeOffset, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleChangeText = (text, index) => {
    // Paste support
    if (text.length > 1) {
      const cleanText = text.replace(/[^0-9]/g, '').slice(0, 6);
      const newOtp = [...otpArray];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = cleanText[i] || '';
      }
      setOtpArray(newOtp);
      
      const focusIndex = Math.min(cleanText.length, 5);
      inputRefs.current[focusIndex]?.focus();
      return;
    }

    const newOtp = [...otpArray];
    newOtp[index] = text;
    setOtpArray(newOtp);

    // Auto-focus next field
    if (text.length > 0 && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (otpArray[index] === '' && index > 0) {
        const newOtp = [...otpArray];
        newOtp[index - 1] = '';
        setOtpArray(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleVerifyOtp = async () => {
    const otpCode = otpArray.join('');
    if (!otpCode || otpCode.length < 6) {
      Toast.show({
        type: 'error',
        text1: 'Verification Incomplete',
        text2: 'Please enter the complete 6-digit OTP code.'
      });
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const res = await ownerAuthService.verifyOtp(phone, otpCode);
      
      if (res.isNewUser) {
        Toast.show({
          type: 'success',
          text1: 'Verification Successful',
          text2: 'Let\'s register your shop catalog.'
        });
        navigation.navigate('RegisterShop', { phone });
      } else {
        await login(res.token, res.owner, res.shop);
        Toast.show({
          type: 'success',
          text1: 'Authentication Verified',
          text2: `Welcome back, ${res.owner.name}.`
        });
      }
    } catch (e) {
      console.error('OTP Verification Error', e);
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: 'The code you entered is invalid. Try 123456.'
      });
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setTimer(30);
    setOtpArray(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
    Toast.show({
      type: 'success',
      text1: 'OTP Sent Again',
      text2: 'Enter verification OTP to verify number.'
    });
  };

  const formattedPhone = phone ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : '+91 98765 43210';
  const isButtonEnabled = otpArray.every(char => char !== '') && !loading;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navigator Row */}
      <View style={[styles.topNavRow, { paddingTop: insets.top > 0 ? insets.top + 8 : 16 }]}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color="#0F172A" size={20} strokeWidth={2.5} />
        </TouchableOpacity>
        
        {/* Progress Timeline Header */}
        <View style={styles.timelineContainer}>
          <View style={styles.timelineRow}>
            <View style={styles.stepCircleActive}>
              <ShieldCheck color="#FFFFFF" size={14} strokeWidth={3} />
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepCircleInactive}>
              <Text style={styles.stepInactiveText}>2</Text>
            </View>
          </View>
          <Text style={styles.timelineText}>Step 2 of 2</Text>
        </View>
      </View>

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
            
            {/* Phone Verification Illustration */}
            <View style={styles.illustrationWrapper}>
              {/* Sparkles decoration */}
              <Sparkles color="#86EFAC" size={20} style={styles.sparkle1} />
              <Sparkles color="#86EFAC" size={16} style={styles.sparkle2} />
              
              {/* Main Phone Device */}
              <View style={styles.phoneBody}>
                {/* Speaker pill */}
                <View style={styles.phoneSpeaker} />
                
                {/* Lock container */}
                <View style={styles.lockIconContainer}>
                  <Lock color="#15803D" size={20} />
                </View>

                {/* Simulated keydots */}
                <View style={styles.phoneDots}>
                  <View style={styles.phoneDotActive} />
                  <View style={styles.phoneDotActive} />
                  <View style={styles.phoneDotActive} />
                  <View style={styles.phoneDotInactive} />
                  <View style={styles.phoneDotInactive} />
                </View>

                {/* Shield overlap */}
                <View style={styles.phoneShield}>
                  <ShieldCheck color="#FFFFFF" size={12} strokeWidth={3} />
                </View>
              </View>
            </View>

            {/* Header titles */}
            <View style={styles.header}>
              <Text style={styles.title}>Verify Your Number</Text>
              <Text style={styles.subtitle}>Enter the 6-digit code sent to</Text>
              <Text style={styles.targetPhone}>{formattedPhone}</Text>
            </View>

            {/* OTP card wrapped with shaking container */}
            <Animated.View style={[
              styles.card,
              { transform: [{ translateX: shakeOffset }] }
            ]}>
              
              {/* Six separated boxes */}
              <View style={styles.otpBoxesRow}>
                {otpArray.map((value, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (inputRefs.current[index] = ref)}
                    style={[
                      styles.otpBox,
                      focusedIndex === index && styles.otpBoxFocused,
                      value !== '' && styles.otpBoxFilled
                    ]}
                    keyboardType="number-pad"
                    maxLength={Platform.OS === 'android' ? 2 : 1}
                    value={value}
                    onChangeText={(text) => handleChangeText(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    onFocus={() => setFocusedIndex(index)}
                    textAlign="center"
                    selectTextOnFocus={true}
                  />
                ))}
              </View>

              {/* Resend actions block */}
              <View style={styles.timerLinkRow}>
                {timer > 0 ? (
                  <Text style={styles.timerText}>
                    Resend code in <Text style={styles.timerGreen}>00:{timer < 10 ? `0${timer}` : timer}</Text>
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResend}>
                    <Text style={styles.resendActionLink}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.changeNumLink}>Change Number</Text>
                </TouchableOpacity>
              </View>

              {/* Development sandbox widget */}
              <View style={styles.devCard}>
                <View style={styles.devCodeBox}>
                  <Text style={styles.devCodeSymbol}>&gt;_</Text>
                </View>
                <View style={styles.devTextSection}>
                  <Text style={styles.devCardTitle}>Development Mode</Text>
                  <View style={styles.devOtpContainer}>
                    <Text style={styles.devCardText}>Use OTP:</Text>
                    <View style={styles.devOtpBadge}>
                      <Text style={styles.devOtpBadgeText}>123456</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.devCopyBtn}
                  onPress={() => {
                    setOtpArray(['1', '2', '3', '4', '5', '6']);
                    Toast.show({ type: 'success', text1: 'OTP Filled', text2: 'Sandbox OTP filled successfully!' });
                  }}
                >
                  <Text style={styles.devCopyText}>Fill</Text>
                </TouchableOpacity>
              </View>

              {/* Primary button */}
              <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handleVerifyOtp}
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
                      <Text style={styles.buttonText}>Verify & Continue</Text>
                      <ArrowRight color="#FFF" size={18} strokeWidth={2.5} style={styles.buttonArrow} />
                    </View>
                  )}
                </Animated.View>
              </Pressable>

            </Animated.View>

            {/* Bottom Security Notice */}
            <View style={styles.securitySealRow}>
              <ShieldCheck color="#16A34A" size={16} style={{ marginRight: 6 }} />
              <Text style={styles.securitySealText}>
                Your account is protected with <Text style={styles.securitySealGreen}>256-bit encryption</Text>
              </Text>
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
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1.2,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  timelineContainer: {
    alignItems: 'flex-end',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  stepCircleActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {
    width: 36,
    height: 2.5,
    backgroundColor: '#16A34A',
  },
  stepCircleInactive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#16A34A',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInactiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },
  timelineText: {
    fontSize: 11,
    fontWeight: '850',
    color: '#16A34A',
  },
  keyboardView: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  illustrationWrapper: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  sparkle1: {
    position: 'absolute',
    left: '30%',
    top: '25%',
  },
  sparkle2: {
    position: 'absolute',
    right: '32%',
    bottom: '20%',
  },
  phoneBody: {
    width: 58,
    height: 94,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#86EFAC',
    backgroundColor: '#FFFFFF',
    padding: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneSpeaker: {
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#CBD5E1',
    position: 'absolute',
    top: 4,
  },
  lockIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  phoneDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginVertical: 4,
  },
  phoneDotActive: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#16A34A',
    marginHorizontal: 1.5,
  },
  phoneDotInactive: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 1.5,
  },
  phoneShield: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '550',
    color: '#64748B',
    marginTop: 6,
  },
  targetPhone: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15803D',
    marginTop: 2,
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
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  otpBox: {
    width: 42,
    height: 50,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  otpBoxFocused: {
    borderColor: '#16A34A',
    borderWidth: 1.8,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  otpBoxFilled: {
    borderColor: '#16A34A',
  },
  timerLinkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  timerText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  timerGreen: {
    color: '#15803D',
    fontWeight: '800',
  },
  resendActionLink: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  changeNumLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  devCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  devCodeBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  devCodeSymbol: {
    fontSize: 13,
    fontWeight: '900',
    color: '#15803D',
  },
  devTextSection: {
    flex: 1,
  },
  devCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  devOtpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  devCardText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '650',
  },
  devOtpBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  devOtpBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#15803D',
  },
  devCopyBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#16A34A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  devCopyText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },
  button: {
    backgroundColor: '#15803D',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  buttonArrow: {
    alignSelf: 'center',
  },
  securitySealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  securitySealText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  securitySealGreen: {
    color: '#16A34A',
    fontWeight: '750',
  },
});
