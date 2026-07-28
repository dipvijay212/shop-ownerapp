import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ownerAuthService } from '../services/ownerAuthService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [owner, setOwner] = useState(null);
  const [shop, setShop] = useState(null);
  const [newOrdersCount, setNewOrdersCount] = useState(0);

  const checkNewOrders = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('owner_orders');
      if (data) {
        const orders = JSON.parse(data);
        const count = orders.filter(o => o.status === 'placed').length;
        setNewOrdersCount(count);
      }
    } catch (e) {
      console.error('[AuthContext] Failed to check new orders count', e);
    }
  }, []);

  useEffect(() => {
    checkNewOrders();
    const interval = setInterval(() => {
      checkNewOrders();
    }, 4000);
    return () => clearInterval(interval);
  }, [checkNewOrders]);

  useEffect(() => {
    const initializeApp = async () => {
      // Minimum display duration for custom SplashScreen animation to complete cleanly
      const minDisplayDuration = new Promise(resolve => setTimeout(resolve, 2500));

      // Perform all initialization (storage, auth validation, API & state setup) in background
      const initTask = (async () => {
        try {
          const storedToken = await AsyncStorage.getItem('owner_token');
          const storedOwner = await AsyncStorage.getItem('owner_profile');
          const storedShop = await AsyncStorage.getItem('owner_shop');

          if (storedToken) {
            try {
              const res = await ownerAuthService.validateToken(storedToken);
              // Token is valid
              setUserToken(storedToken);
              setOwner(res.owner);
              setShop(res.shop);
            } catch (apiError) {
              // Token is invalid/expired or data is missing - force logout
              console.log('[AuthContext] Token validation failed, clearing session.');
              await AsyncStorage.removeItem('owner_token');
              await AsyncStorage.removeItem('owner_profile');
              await AsyncStorage.removeItem('owner_shop');
              setUserToken(null);
              setOwner(null);
              setShop(null);
            }
          }
        } catch (e) {
          console.error('[AuthContext] Failed to load storage data', e);
        }
      })();

      // Wait for both background initialization AND minimum splash display to finish
      await Promise.all([initTask, minDisplayDuration]);

      // Transition smoothly to Onboarding, Login, or Home without flickering
      setIsLoading(false);
    };

    initializeApp();
  }, []);

  const login = useCallback(async (token, ownerData, shopData) => {
    try {
      await AsyncStorage.setItem('owner_token', token);
      await AsyncStorage.setItem('owner_profile', JSON.stringify(ownerData));
      await AsyncStorage.setItem('owner_shop', JSON.stringify(shopData));
      
      setUserToken(token);
      setOwner(ownerData);
      setShop(shopData);
    } catch (e) {
      console.error('[AuthContext] Failed to save login info', e);
    }
  }, []);

  const registerShop = useCallback(async (registrationData) => {
    try {
      const res = await ownerAuthService.registerOwner(registrationData);
      
      await AsyncStorage.setItem('owner_token', res.token);
      await AsyncStorage.setItem('owner_profile', JSON.stringify(res.owner));
      await AsyncStorage.setItem('owner_shop', JSON.stringify(res.shop));

      setUserToken(res.token);
      setOwner(res.owner);
      setShop(res.shop);
      
      return res;
    } catch (e) {
      console.error('[AuthContext] Failed to register shop', e);
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('owner_token');
      await AsyncStorage.removeItem('owner_profile');
      await AsyncStorage.removeItem('owner_shop');
      
      setUserToken(null);
      setOwner(null);
      setShop(null);
    } catch (e) {
      console.error('[AuthContext] Failed to clear login info', e);
    }
  }, []);

  const updateShopState = useCallback(async (updatedShop) => {
    try {
      await AsyncStorage.setItem('owner_shop', JSON.stringify(updatedShop));
      setShop(updatedShop);
    } catch (e) {
      console.error('[AuthContext] Failed to update local shop state', e);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        userToken,
        owner,
        shop,
        login,
        logout,
        registerShop,
        updateShopState,
        newOrdersCount,
        checkNewOrders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
