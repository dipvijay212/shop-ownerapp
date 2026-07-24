import React, { useContext, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LayoutDashboard, ClipboardList, ShoppingBag, Users, Menu } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardScreen } from '../screens/DashboardScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { ProductsScreen } from '../screens/ProductsScreen';
import { CustomersScreen } from '../screens/CustomersScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { theme } from '../theme';
import { AuthContext } from '../context/AuthContext';

const Tab = createBottomTabNavigator();

const TabButton = ({ label, isFocused, onPress, onLongPress, routeName, newOrdersCount }) => {
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
    case 'Customers':
      IconComponent = Users;
      break;
    case 'Profile':
      IconComponent = Menu;
      break;
    default:
      IconComponent = ClipboardList;
  }

  // Check if we need to show badge (only for Orders)
  const showBadge = routeName === 'Orders' && newOrdersCount > 0;
  const badgeText = newOrdersCount > 99 ? '99+' : newOrdersCount.toString();

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
      </Animated.View>
      <Text style={[styles.label, isFocused ? styles.labelActive : styles.labelInactive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const CustomTabBar = ({ state, descriptors, navigation, insets, newOrdersCount }) => {
  return (
    <View style={[
      styles.tabBarContainer, 
      { 
        height: 76 + insets.bottom, 
        paddingBottom: insets.bottom + (Platform.OS === 'ios' ? 4 : 8),
        paddingTop: 8
      }
    ]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name === 'Profile'
            ? 'More'
            : route.name;

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
          />
        );
      })}
    </View>
  );
};

export const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  const { newOrdersCount } = useContext(AuthContext);

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} insets={insets} newOrdersCount={newOrdersCount} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Products" component={ProductsScreen} />
      <Tab.Screen name="Customers" component={CustomersScreen} />
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
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
