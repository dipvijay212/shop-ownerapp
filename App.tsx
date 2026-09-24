import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { navigationRef } from './src/navigation/navigationRef';
import { PushGate } from './src/navigation/PushGate';

import { AppUpdateChecker } from './src/components/AppUpdateChecker';

const queryClient = new QueryClient();

const linking = {
  prefixes: ['localshopsowner://'],
};

const App = () => {
  // NavigationContainer only reports ready once a navigator has mounted, which
  // it has not while RootNavigator is showing the splash. A COUNTER, not a
  // boolean: the navigator remounts whenever the shop's state swaps the stack,
  // and re-setting a boolean that is already true would render nothing, which
  // would strand a tapped notification waiting on the navigator.
  const [navReadyTick, setNavReadyTick] = useState(0);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SafeAreaProvider>
          <NavigationContainer
            ref={navigationRef}
            linking={linking}
            onReady={() => setNavReadyTick((tick) => tick + 1)}
          >
            <RootNavigator />
            <AppUpdateChecker />
            <PushGate navReadyTick={navReadyTick} />
            <Toast />
          </NavigationContainer>
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
