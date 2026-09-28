import { Platform, Linking } from 'react-native';
import { FALLBACK_STORE_URL } from '../config/appUpdateConfig';

/**
 * Opens the store link the admin set for this platform (from GET /app-config),
 * or the Play listing when none came through.
 */
export const openStore = async (storeUrl = null) => {
  const url = storeUrl || FALLBACK_STORE_URL[Platform.OS === 'ios' ? 'ios' : 'android'];
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch (error) {
    console.error('Failed to open app store link:', error);
  }
};
