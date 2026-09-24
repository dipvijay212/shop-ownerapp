import React, { useContext, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LayoutDashboard, ClipboardList, ShoppingBag, Repeat, Menu } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardScreen } from '../screens/DashboardScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { ProductsScreen } from '../screens/ProductsScreen';
import { SubscribersScreen } from '../screens/SubscribersScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { theme } from '../theme';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../constants/translations';

const Tab = createBottomTabNavigator();

const TabButton = ({ label, isFocused, onPress, onLongPress, routeName, newOrdersCount, newSubscriptionsCount, pendingKhataCount }) => {
  const animatedScale = useRef(new Animated.Value(isFocused ? 1.1 : 1)).current;
  const animatedOpacity = useRef(new Animated.Value(isFocused ? 1 : 0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(animatedScale, {
        toValue: isFocused ? 1.08 : 1,
        friction: 6,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(animatedOpacity, {
        toValue: isFocused ? 1 : 0.85,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();
  }, [isFocused]);

  let IconComponent;
  switch (routeName) {
    case 'Dashboard':
      IconComponent = LayoutDashboard;
      break;
    case 'Orders':
      IconComponent = ClipboardList;
      break;
    case 'Products':
      IconComponent = ShoppingBag;
      break;
    case 'Subscriptions':
      IconComponent = Repeat;
      break;
    case 'Profile':
      IconComponent = Menu;
      break;
    default:
      IconComponent = ClipboardList;
  }

  // Orders carries its count; Subscriptions carries a plain dot, because the
  // number there is not the point — "something arrived" is. The dot used to sit
  // on More, back when the round was buried behind it.
  const showBadge = routeName === 'Orders' && newOrdersCount > 0;
  const badgeText = newOrdersCount > 99 ? '99+' : newOrdersCount.toString();
  // More is where Khata ended up when Subscriptions took its place in the bar,
  // so a khata request waiting on a decision has to announce itself here or the
  // owner only finds it by going looking. A dot, not a count — the number lives
  // on the Khata row one tap in, which is where it can be acted on.
  const showDot =
    (routeName === 'Subscriptions' && newSubscriptionsCount > 0) ||
    (routeName === 'Profile' && pendingKhataCount > 0);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabButton}
    >
      <Animated.View
        style={[
          styles.pillContainer,
          isFocused && styles.pillActive,
          { transform: [{ scale: animatedScale }], opacity: animatedOpacity },
        ]}
      >
        <IconComponent
          color={isFocused ? '#16A34A' : '#64748B'}
          size={20}
          strokeWidth={isFocused ? 2.5 : 2}
        />
        {showBadge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        )}
        {showDot && <View style={styles.dot} />}
      </Animated.View>
      <Text style={[styles.label, isFocused ? styles.labelActive : styles.labelInactive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const CustomTabBar = ({ state, descriptors, navigation, insets, newOrdersCount, newSubscriptionsCount, pendingKhataCount }) => {
  const { t } = useTranslation();

  const getTabLabel = (name) => {
    switch (name) {
      case 'Dashboard': return t('tabHome', 'Home');
      case 'Orders': return t('tabOrders', 'Orders');
      case 'Products': return t('tabProducts', 'Products');
      case 'Subscriptions': return t('tabSubscriptions', 'Subscriptions');
      case 'Profile': return t('tabMore', 'More');
      default: return name;
    }
  };

  const bottomPadding = Platform.OS === 'ios' 
    ? (insets.bottom ? insets.bottom - 10 : 10) 
    : (insets.bottom > 0 ? insets.bottom + 6 : 14);

  return (
    <View style={[
      styles.tabBarContainer, 
      { 
        paddingBottom: bottomPadding,
        paddingTop: 6,
      }
    ]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = getTabLabel(route.name);

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TabButton
            key={route.key}
            label={label}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
            routeName={route.name}
            newOrdersCount={newOrdersCount}
            newSubscriptionsCount={newSubscriptionsCount}
            pendingKhataCount={pendingKhataCount}
          />
        );
      })}
    </View>
  );
};

export const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  const { newOrdersCount, newSubscriptionsCount, pendingKhataCount } = useContext(AuthContext);

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <CustomTabBar
          {...props}
          insets={insets}
          newOrdersCount={newOrdersCount}
          newSubscriptionsCount={newSubscriptionsCount}
          pendingKhataCount={pendingKhataCount}
        />
      )}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      {/* Beside Orders, because the round is the other half of the morning's
          work. Khata moved out to More in the same swap. */}
      <Tab.Screen name="Subscriptions" component={SubscribersScreen} />
      <Tab.Screen name="Products" component={ProductsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1.2,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 12,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  pillContainer: {
    width: 56,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    marginBottom: 4,
    position: 'relative',
  },
  pillActive: {
    backgroundColor: '#DCFCE7',
  },
  dot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.2,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  labelActive: {
    color: '#16A34A',
  },
  labelInactive: {
    color: '#64748B',
  },
});
