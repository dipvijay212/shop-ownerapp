import React, { useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay, 
  withSpring,
  Easing
} from 'react-native-reanimated';
import { Store } from 'lucide-react-native';
import { theme } from '../theme';

const { width } = Dimensions.get('window');

export const SplashScreen = () => {
  const iconScale = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);

  useEffect(() => {
    // Animate icon pop
    iconScale.value = withSpring(1, { damping: 12, stiffness: 90 });
    
    // Fade and slide up text
    textOpacity.value = withDelay(
      300, 
      withTiming(1, { duration: 800, easing: Easing.out(Easing.exp) })
    );
    textTranslateY.value = withDelay(
      300, 
      withTiming(0, { duration: 800, easing: Easing.out(Easing.exp) })
    );
  }, [iconScale, textOpacity, textTranslateY]);

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: iconScale.value }],
    };
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      opacity: textOpacity.value,
      transform: [{ translateY: textTranslateY.value }],
    };
  });

  return (
    <View style={styles.container}>
      {/* Central Shop Icon */}
      <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
        <Store color={theme.colors.primary} size={70} strokeWidth={2.5} />
      </Animated.View>

      {/* App Branding */}
      <Animated.View style={[styles.textContainer, animatedTextStyle]}>
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
