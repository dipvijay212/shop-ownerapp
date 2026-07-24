import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, Image, ScrollView, Platform } from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Store, ArrowRight, ShieldCheck } from 'lucide-react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

// Languages array removed

export const LanguageSelectScreen = () => {
  const navigation = useNavigation();

  const handleGetStarted = (mode) => {
    if (mode === 'register') {
      navigation.navigate('ProfileSetup', { isRegistration: true });
    } else {
      navigation.navigate('Login');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.scrollContent}>
        
        {/* Full-bleed Hero Illustration */}
        <View style={styles.heroContainer}>
          <Image 
            source={require('../../assets/hero_welcome.jpg')}
            style={styles.heroImage}
            resizeMode="cover"
          />
          {/* Subtle gradient fade blending into background */}
          <View style={styles.gradientOverlay}>
            <Svg height="100%" width="100%">
              <Defs>
                <SvgLinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#FAF9F6" stopOpacity="0" />
                  <Stop offset="1" stopColor="#FAF9F6" stopOpacity="1" />
                </SvgLinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
            </Svg>
          </View>
        </View>

        {/* Content Block */}
        <View style={styles.content}>
          {/* Logo Badge */}
          <View style={styles.logoBadge}>
            <Store color="#2E7D32" size={24} />
          </View>

          {/* Texts */}
          <Text style={styles.title}>Welcome to Local Shops</Text>
          <Text style={styles.subtitle}>Your neighborhood, delivered.</Text>
          

          {/* Actions */}
          <TouchableOpacity style={styles.primaryButton} onPress={() => handleGetStarted('register')} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>Create an account</Text>
            <ArrowRight color="#FFF" size={22} style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.signInButton} onPress={() => handleGetStarted('login')} activeOpacity={0.6}>
            <Text style={styles.signInText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.spacer} />

        {/* Footer */}
        <View style={styles.footer}>
          <ShieldCheck color="#999" size={16} style={{ marginRight: 6 }} />
          <Text style={styles.footerText}>Secure, Local, Community-First</Text>
        </View>
        
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6', // Warm off-white background
  },
  scrollContent: {
    flex: 1,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  heroContainer: {
    width: '100%',
    height: height * 0.45, // Restored to a larger size since we have more space now
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80, // Reduced height for smoother tight fade
  },
  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26, // Overlaps the bottom of the hero image
    marginBottom: 12, // Tightened
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 24, // Reduced to fit on one line
    fontWeight: '800',
    color: '#2E7D32', // Deep forest green
    marginBottom: 4, // Tightened gap
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#777',
    marginBottom: 40, // Increased gap to balance the removed language selector
    textAlign: 'center',
  },
  // Language styles removed
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#2E7D32',
    width: '100%',
    height: 56, // Still generous, slightly reduced from 60
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12, // Tightened gap
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    fontSize: 18,
    color: '#FFF',
    fontWeight: 'bold',
  },
  signInButton: {
    paddingVertical: 8, // Tightened gap
  },
  signInText: {
    fontSize: 15,
    color: '#A8D5BA', // Sage green accent
    fontWeight: '600',
  },
  spacer: {
    flex: 1, // Will push the footer to the bottom of the space
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: Platform.OS === 'android' ? 32 : 16, // Extra padding for Android nav bar
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  }
});

export default LanguageSelectScreen;
