import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, StatusBar, Image } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRoute, useNavigation } from '@react-navigation/native';
import { theme } from '../../theme';
import { authService } from '../../services/authService';
import Toast from 'react-native-toast-message';
import { AuthContext } from '../../context/AuthContext';
import { User, Mail, ShieldCheck, Camera, Calendar, Smartphone, ArrowLeft } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';

export const ProfileSetupScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { isRegistration, isVerified } = route.params || {};
  
  const { appLanguage, login } = useContext(AuthContext);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [phoneError, setPhoneError] = useState('');
  const [nameError, setNameError] = useState('');

  const handlePickPhoto = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      if (result.assets && result.assets.length > 0) {
        setPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.log('Image picker error:', error);
      // Fallback if the user hasn't restarted the native build yet
      setPhoto('https://ui-avatars.com/api/?name=New+User&background=E8F5E9&color=2E7D32&size=200');
      Toast.show({ 
        type: 'info', 
        text1: 'Rebuild Required', 
        text2: 'Using a placeholder. Restart npm run android to enable real photo uploads.' 
      });
    }
  };

  const handleSubmit = async () => {
    let isValid = true;
    
    if (!name.trim()) {
      setNameError('Please enter your full name');
      isValid = false;
    } else {
      setNameError('');
    }

    if (!phone || phone.length < 10) {
      setPhoneError('Enter a valid 10-digit mobile number');
      isValid = false;
    } else {
      setPhoneError('');
    }

    if (!isValid) return;

    setLoading(true);
    try {
      if (isVerified) {
        // User already verified OTP via Login Screen
        const res = await authService.createProfile({ phone, name, email, dob, photo, language: appLanguage || 'en' });
        Toast.show({ type: 'success', text1: 'Profile Created!', text2: 'Welcome to Local Shops.' });
        await login(res.token, res.customer);
      } else {
        // Normal registration flow
        await authService.sendOtp(phone);
        Toast.show({ type: 'success', text1: 'OTP Sent', text2: 'Check your messages for the code.' });
        
        navigation.navigate('VerifyOTP', { 
          phone, 
          isRegistration: true, 
          profileData: { name, email, dob, photo, language: appLanguage || 'en' } 
        });
      }
    } catch (e) {
      console.log('Error', e);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  };

  const getInputStyle = (fieldName, hasError) => [
    styles.inputContainer,
    focusedField === fieldName && styles.inputContainerFocused,
    hasError && styles.inputContainerError
  ];

  const getIconColor = (fieldName) => 
    focusedField === fieldName ? theme.colors.primary : '#94A3B8';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <KeyboardAwareScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          enableAutomaticScroll={true}
          extraScrollHeight={20}
        >
          {/* Top Bar */}
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft color="#1E293B" size={24} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Complete Profile</Text>
            <Text style={styles.subtitle}>Add your details to personalize your shopping experience.</Text>
          </View>
          
          {/* Photo Section */}
          <View style={styles.photoSection}>
            <TouchableOpacity style={styles.avatarPlaceholder} activeOpacity={0.8} onPress={handlePickPhoto}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.avatarImage} />
              ) : (
                <User color="#CBD5E1" size={40} />
              )}
              <View style={styles.cameraBadge}>
                <Camera color="#FFF" size={16} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            {/* Phone Number */}
            <Text style={styles.inputLabel}>Mobile Number</Text>
            <View style={getInputStyle('phone', !!phoneError)}>
              <Smartphone color={getIconColor('phone')} size={20} style={styles.inputIcon} />
              <View style={styles.prefixContainer}>
                <Text style={styles.prefix}>+91</Text>
                <View style={styles.prefixDivider} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="10-digit number"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text.replace(/[^0-9]/g, ''));
                  if (phoneError) setPhoneError('');
                }}
                maxLength={10}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            {!!phoneError && <Text style={styles.errorText}>{phoneError}</Text>}

            {/* Full Name */}
            <Text style={styles.inputLabel}>Full Name <Text style={styles.asterisk}>*</Text></Text>
            <View style={getInputStyle('name', !!nameError)}>
              <User color={getIconColor('name')} size={20} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (nameError) setNameError('');
                }}
                autoCapitalize="words"
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}

            {/* Email */}
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <Text style={styles.optionalBadge}>Optional</Text>
            </View>
            <View style={getInputStyle('email')}>
              <Mail color={getIconColor('email')} size={20} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="hello@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            
            {/* Date of Birth */}
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Date of Birth</Text>
              <Text style={styles.optionalBadge}>Optional</Text>
            </View>
            <View style={getInputStyle('dob')}>
              <Calendar color={getIconColor('dob')} size={20} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="DD / MM / YYYY"
                placeholderTextColor="#94A3B8"
                value={dob}
                onChangeText={setDob}
                maxLength={10}
                onFocus={() => setFocusedField('dob')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>
        </KeyboardAwareScrollView>
        
        {/* Bottom Button & Footer (Fixed at bottom) */}
        <View style={[styles.bottomSection, { paddingHorizontal: 24 }]}>
          <TouchableOpacity 
            style={[styles.button, (!name.trim() || phone.length < 10) && styles.buttonDisabled]} 
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={styles.buttonText}>{isVerified ? 'Complete Profile' : 'Continue to Verification'}</Text>
            )}
          </TouchableOpacity>
          <View style={styles.footer}>
            <ShieldCheck color="#94A3B8" size={16} style={{ marginRight: 6 }} />
            <Text style={styles.footerText}>Secure & Encrypted</Text>
          </View>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 0,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 50,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  formContainer: {
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginLeft: 4,
  },
  asterisk: {
    color: '#EF4444',
  },
  optionalBadge: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#F8FAFC',
    marginBottom: 16,
    height: 48,
    paddingHorizontal: 16,
  },
  inputContainerFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: theme.colors.primary,
  },
  inputContainerError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: -16,
    marginBottom: 20,
    marginLeft: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  prefixContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefix: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  prefixDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#0F172A',
    paddingVertical: 0,
  },
  bottomSection: {
    paddingTop: 16,
    paddingBottom: Platform.OS === 'android' ? 36 : (Platform.OS === 'ios' ? 20 : 0),
    backgroundColor: 'transparent',
    marginTop: 20,
  },
  button: {
    backgroundColor: theme.colors.primary,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  }
});
