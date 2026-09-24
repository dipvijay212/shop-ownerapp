// In-app stand-in for the system notification, which neither Android nor iOS
// draws while the app is in the foreground. One at a time: a newer message
// replaces whatever is showing and restarts the timer.

import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { theme } from '../theme';

const VISIBLE_MS = 5000;
const HIDDEN_OFFSET = -240;

export const PushBanner = ({ message, onPress, onDismiss }) => {
  const insets = useSafeAreaInsets();
  const offset = useRef(new Animated.Value(HIDDEN_OFFSET)).current;

  useEffect(() => {
    if (!message) return undefined;
    offset.setValue(HIDDEN_OFFSET);
    Animated.spring(offset, { toValue: 0, bounciness: 4, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(offset, { toValue: HIDDEN_OFFSET, duration: 200, useNativeDriver: true }).start(onDismiss);
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message, offset, onDismiss]);

  if (!message) return null;
  const { title, body } = message.notification || {};

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: insets.top + 8, transform: [{ translateY: offset }] }]}
    >
      <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
        <View style={styles.icon}>
          <Bell color={theme.colors.primary} size={20} />
        </View>
        <View style={styles.text}>
          {!!title && <Text style={styles.title} numberOfLines={1}>{title}</Text>}
          {!!body && <Text style={styles.body} numberOfLines={2}>{body}</Text>}
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 1000,
    elevation: 1000,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textLight,
    marginTop: 2,
  },
});

export default PushBanner;
