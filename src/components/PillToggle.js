import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Animated } from 'react-native';
import { theme } from '../theme';

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 24;
const KNOB_SIZE = 18;
const KNOB_MARGIN = 3;

export const PillToggle = ({ value, onValueChange, disabled = false }) => {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const trackColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#CBD5E1', theme.colors.primary],
  });

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [KNOB_MARGIN, TRACK_WIDTH - KNOB_SIZE - KNOB_MARGIN],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={{ width: TRACK_WIDTH, height: TRACK_HEIGHT, justifyContent: 'center' }}
    >
      <Animated.View
        style={{
          width: TRACK_WIDTH,
          height: TRACK_HEIGHT,
          borderRadius: TRACK_HEIGHT / 2,
          backgroundColor: trackColor,
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={{
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            borderRadius: KNOB_SIZE / 2,
            backgroundColor: '#FFFFFF',
            transform: [{ translateX }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.2,
            shadowRadius: 2,
            elevation: 2,
          }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};
