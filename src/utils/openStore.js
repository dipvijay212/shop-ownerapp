import { Platform, Linking } from 'react-native';
import { APP_UPDATE_CONFIG } from '../config/appUpdateConfig';

/**
 * Platform-aware store launcher helper.
 * Redirects owner to Play Store (Android) or App Store (iOS).
 */
export const openStore = async (customConfig = null) => {
  const config = customConfig || APP_UPDATE_CONFIG;
  const storeUrl = Platform.OS === 'ios' ? config.iosUrl : config.androidUrl;

  if (!storeUrl) {
    console.warn('App store URL is not configured.');
    return;
  }

  try {
    const supported = await Linking.canOpenURL(storeUrl);
    if (supported) {
      await Linking.openURL(storeUrl);
    } else {
      // Fallback open attempt
      await Linking.openURL(storeUrl);
    }
  } catch (error) {
    console.error('Failed to open app store link:', error);
  }
};
