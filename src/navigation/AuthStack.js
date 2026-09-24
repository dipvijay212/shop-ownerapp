import React, { useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../context/AuthContext';
import { LanguageSelectScreen } from '../screens/auth/LanguageSelectScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { VerifyOTPScreen } from '../screens/auth/VerifyOTPScreen';
import { RegisterShopScreen } from '../screens/auth/RegisterShopScreen';
import { DocumentUploadScreen } from '../screens/DocumentUploadScreen';

const Stack = createNativeStackNavigator();

export const AuthStack = () => {
  // Language is picked before anything else, once. It used to sit inside the
  // registration flow, so an owner had to log in before they could read the
  // app in their own language.
  const { languageChosen } = useContext(AuthContext);

  return (
    <Stack.Navigator
      initialRouteName={languageChosen ? 'Login' : 'LanguageSelect'}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="LanguageSelect" component={LanguageSelectScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
      <Stack.Screen name="RegisterShop" component={RegisterShopScreen} />
      <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
    </Stack.Navigator>
  );
};
