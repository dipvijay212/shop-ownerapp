import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Dimensions, Animated, Easing } from 'react-native';
import { Store } from 'lucide-react-native';
import BootSplash from 'react-native-bootsplash';
import { theme } from '../theme';

const { width } = Dimensions.get('window');

export const SplashScreen = () => {
  const iconScale = useRef(new Animated.Value(0.85)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const textTranslateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    // Keep BootSplash visible until React Native is fully ready, then immediately
    // transition to custom SplashScreen without showing any intermediate loading screen.
    BootSplash.hide({ fade: false });

    // Smoothly animate the store icon and branding into final position using Native Driver
    Animated.parallel([
      Animated.spring(iconScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(textTranslateY, {
        toValue: 0,
        duration: 450,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [iconScale, textTranslateY]);

  return (
    <View style={styles.container}>
      {/* Central Shop Icon */}
      <Animated.View style={[styles.iconContainer, { transform: [{ scale: iconScale }] }]}>
        <Store color={theme.colors.primary} size={70} strokeWidth={2.5} />
      </Animated.View>

      {/* App Branding */}
      <Animated.View style={[styles.textContainer, { opacity: contentOpacity, transform: [{ translateY: textTranslateY }] }]}>
        <Text style={styles.title}>Local Shops</Text>
        
        {/* Owner/Business Badge */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>FOR BUSINESS</Text>
        </View>
      </Animated.View>

      {/* Correctly Positioned Loader Container */}
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6', // Matches theme background
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: '#E8F5E9',
    padding: 24,
    borderRadius: 36,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#2E7D32',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FAF9F6',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    width: 50,
  },
});
