// Token + device-identity storage for the Owner app.

import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY = 'lm.owner.access_token';
const REFRESH_KEY = 'lm.owner.refresh_token';
const DEVICE_KEY = 'lm.owner.device_id';
const OWNER_KEY = 'lm.owner.profile';
const SHOP_KEY = 'lm.owner.shop';

let accessToken = null;
let refreshToken = null;
let deviceId = null;

const logoutListeners = new Set();

export const onSessionExpired = (listener) => {
  logoutListeners.add(listener);
  return () => logoutListeners.delete(listener);
};

export const emitSessionExpired = () => {
  logoutListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      // One bad listener must not stop the others from logging out.
    }
  });
};

const randomId = () => {
  const chunk = () => Math.random().toString(36).slice(2, 10);
  return `${chunk()}${chunk()}${chunk()}`.slice(0, 24);
};

export const getDeviceId = async () => {
  if (deviceId) return deviceId;
  let stored = await AsyncStorage.getItem(DEVICE_KEY);
  if (!stored) {
    stored = `rn-own-${randomId()}`;
    await AsyncStorage.setItem(DEVICE_KEY, stored);
  }
  deviceId = stored;
  return deviceId;
};

export const getAccessToken = () => accessToken;
export const getRefreshToken = () => refreshToken;

export const loadSession = async () => {
  const [access, refresh, ownerJson, shopJson] = await Promise.all([
    AsyncStorage.getItem(ACCESS_KEY),
    AsyncStorage.getItem(REFRESH_KEY),
    AsyncStorage.getItem(OWNER_KEY),
    AsyncStorage.getItem(SHOP_KEY),
  ]);
  accessToken = access;
  refreshToken = refresh;
  await getDeviceId();
  return {
    accessToken: access,
    refreshToken: refresh,
    owner: ownerJson ? JSON.parse(ownerJson) : null,
    shop: shopJson ? JSON.parse(shopJson) : null,
  };
};

// { access_token, refresh_token, access_expires_in, is_new_user }
export const saveTokens = async ({ access_token, refresh_token }) => {
  accessToken = access_token ?? accessToken;
  refreshToken = refresh_token ?? refreshToken;

  const writes = [];
  if (access_token) writes.push(AsyncStorage.setItem(ACCESS_KEY, access_token));
  if (refresh_token) writes.push(AsyncStorage.setItem(REFRESH_KEY, refresh_token));
  await Promise.all(writes);
};

export const saveOwner = async (owner) => {
  if (!owner) return AsyncStorage.removeItem(OWNER_KEY);
  return AsyncStorage.setItem(OWNER_KEY, JSON.stringify(owner));
};

export const saveShop = async (shop) => {
  if (!shop) return AsyncStorage.removeItem(SHOP_KEY);
  return AsyncStorage.setItem(SHOP_KEY, JSON.stringify(shop));
};

export const clearSession = async () => {
  accessToken = null;
  refreshToken = null;
  try {
    if (typeof AsyncStorage.removeMany === 'function') {
      await AsyncStorage.removeMany([ACCESS_KEY, REFRESH_KEY, OWNER_KEY, SHOP_KEY]);
    } else if (typeof AsyncStorage.multiRemove === 'function') {
      await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY, OWNER_KEY, SHOP_KEY]);
    } else {
      await Promise.all([
        AsyncStorage.removeItem(ACCESS_KEY),
        AsyncStorage.removeItem(REFRESH_KEY),
        AsyncStorage.removeItem(OWNER_KEY),
        AsyncStorage.removeItem(SHOP_KEY),
      ]);
    }
  } catch (e) {
    console.warn('[session] clearSession failed', e);
  }
};
