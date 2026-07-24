import React, { useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../context/AuthContext';
import { AuthStack } from './AuthStack';
import { TabNavigator } from './TabNavigator';
import { SplashScreen } from '../screens/SplashScreen';
import { DeliveryAreaScreen } from '../screens/DeliveryAreaScreen';
import BootSplash from 'react-native-bootsplash';

const Stack = createNativeStackNavigator();

export const RootNavigator = () => {
  const { isLoading, userToken } = useContext(AuthContext);

  React.useEffect(() => {
    // Hide the native splash screen as soon as React Native boots.
    // The In-JS SplashScreen handles subsequent state transitions cleanly.
    BootSplash.hide({ fade: true });
  }, []);

  // Display the In-JS loading/splash screen while parsing AsyncStorage.
  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!userToken ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="DeliveryArea" component={DeliveryAreaScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};
