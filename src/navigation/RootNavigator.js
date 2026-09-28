import React, { useContext, useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext, SHOP_ROUTE } from '../context/AuthContext';
import { AuthStack } from './AuthStack';
import { TabNavigator } from './TabNavigator';
import { SplashScreen } from '../screens/SplashScreen';
import { DeliveryAreaScreen } from '../screens/DeliveryAreaScreen';
import { LanguageSettingsScreen } from '../screens/LanguageSettingsScreen';
import { ShopStatusScreen } from '../screens/ShopStatusScreen';
import { CustomersScreen } from '../screens/CustomersScreen';
import { RoundHistoryScreen } from '../screens/RoundHistoryScreen';
import { SubscriptionPaymentScreen } from '../screens/SubscriptionPaymentScreen';
import { ShopUnavailableScreen } from '../screens/ShopUnavailableScreen';
import { RegisterShopScreen } from '../screens/auth/RegisterShopScreen';
import { DocumentUploadScreen } from '../screens/DocumentUploadScreen';
import { DeleteAccountScreen } from '../screens/DeleteAccountScreen';
import { DeletionSubmittedScreen } from '../screens/DeletionSubmittedScreen';

const Stack = createNativeStackNavigator();

// Auth bootstrapping can resolve in a few milliseconds (e.g. a warm start with
// a stored token), which tore the splash down mid-animation — the mark was up
// but the rule and slogan had not faded in yet. Hold it long enough for the
// entrance to finish; the dot is home by ~1.8s.
const MIN_SPLASH_DURATION_MS = 2000;

export const RootNavigator = () => {
  const { isLoading, userToken, shopRoute, shop, shopKnown, accountNotice } = useContext(AuthContext);
  const [minDurationElapsed, setMinDurationElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinDurationElapsed(true), MIN_SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading || !minDurationElapsed) return <SplashScreen />;

  // A confirmed deletion request has just locked the account.
  if (!userToken && accountNotice) return <DeletionSubmittedScreen />;

  if (!userToken) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Auth" component={AuthStack} />
      </Stack.Navigator>
    );
  }

  // Signed in — GET /owner/shop decides where the owner lands (§2.3).
  // Only the screens valid for the current state are mounted, so there is no
  // way to navigate into the dashboard before the shop is approved.
  //
  // The wizard is only correct when the server actually confirmed there is no
  // shop. Without this guard a failed /owner/shop read leaves `shop` null and
  // is indistinguishable from a brand-new owner, which threw owners with an
  // approved shop into onboarding with no way back.
  if (!shopKnown && !shop) {
    return <ShopUnavailableScreen />;
  }

  // Each branch gets its own `key` so a status change remounts the stack.
  // These branches are the same component at the same position, so without a
  // key React reuses the navigator and React Navigation keeps every route
  // whose name still exists. Onboarding → pending kept [RegisterShop,
  // DocumentUpload] on screen after a successful submit (both are in the
  // status stack too), and pending → approved kept ShopStatus up.
  if (shopRoute === SHOP_ROUTE.ONBOARDING) {
    return (
      <Stack.Navigator key="onboarding" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="RegisterShop" component={RegisterShopScreen} />
        <Stack.Screen name="DeliveryArea" component={DeliveryAreaScreen} />
        <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} />
        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
        <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
      </Stack.Navigator>
    );
  }

  if (shopRoute !== SHOP_ROUTE.DASHBOARD) {
    // pending_verification · rejected · suspended. One key for all three:
    // a resubmit from DocumentUpload goes back to ShopStatus itself.
    return (
      <Stack.Navigator key="status" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ShopStatus" component={ShopStatusScreen} />
        <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
        <Stack.Screen name="RegisterShop" component={RegisterShopScreen} />
        <Stack.Screen name="DeliveryArea" component={DeliveryAreaScreen} />
        <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} />
        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator key="dashboard" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="DeliveryArea" component={DeliveryAreaScreen} />
      <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="ShopStatus" component={ShopStatusScreen} />
      <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
      <Stack.Screen name="Customers" component={CustomersScreen} />
      <Stack.Screen name="RoundHistory" component={RoundHistoryScreen} />
      {/* Approved branch only — an unapproved shop has nothing to keep visible,
          so it must not be able to reach a payment screen at all. */}
      <Stack.Screen name="SubscriptionPayment" component={SubscriptionPaymentScreen} />
    </Stack.Navigator>
  );
};
