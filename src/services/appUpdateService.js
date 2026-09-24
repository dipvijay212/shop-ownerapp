import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_UPDATE_CONFIG } from '../config/appUpdateConfig';
import { UPDATE_TEST_MODE, UPDATE_TEST_TYPE } from '../config/updateTestConfig';
import { getCurrentAppVersion } from '../utils/appVersion';
import { compareVersions } from '../utils/versionCompare';

export const UPDATE_TYPES = {
  NO_UPDATE: 'NO_UPDATE',
  SOFT_UPDATE: 'SOFT_UPDATE',
  HARD_UPDATE: 'HARD_UPDATE',
};

const DISMISSED_TIMESTAMP_KEY = '@app_update_soft_dismissed_at';
const SOFT_UPDATE_COOLDOWN_HOURS = 24;

/**
 * Checks whether soft update is currently in cooldown period (24 hours).
 */
export const isSoftUpdateInCooldown = async () => {
  try {
    const rawTime = await AsyncStorage.getItem(DISMISSED_TIMESTAMP_KEY);
    if (!rawTime) return false;

    const dismissedTime = parseInt(rawTime, 10);
    if (isNaN(dismissedTime)) return false;

    const now = Date.now();
    const elapsedHours = (now - dismissedTime) / (1000 * 60 * 60);

    return elapsedHours < SOFT_UPDATE_COOLDOWN_HOURS;
  } catch (error) {
    console.error('Error checking soft update cooldown:', error);
    return false;
  }
};

/**
 * Records timestamp when shop owner taps "Maybe Later" for soft update.
 */
export const recordSoftUpdateDismissed = async () => {
  try {
    await AsyncStorage.setItem(DISMISSED_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error saving soft update dismissal timestamp:', error);
  }
};

/**
 * Clears soft update cooldown timestamp (useful for testing/resetting).
 */
export const resetSoftUpdateCooldown = async () => {
  try {
    await AsyncStorage.removeItem(DISMISSED_TIMESTAMP_KEY);
  } catch (error) {
    console.error('Error resetting soft update cooldown:', error);
  }
};

/**
 * Core service function to check for app update status.
 * Returns update type, versions, and modal visibility state.
 */
export const checkAppUpdate = async () => {
  try {
    let updateType = UPDATE_TYPES.NO_UPDATE;

    if (UPDATE_TEST_MODE) {
      if (UPDATE_TEST_TYPE === 'hard') {
        updateType = UPDATE_TYPES.HARD_UPDATE;
      } else if (UPDATE_TEST_TYPE === 'soft') {
        updateType = UPDATE_TYPES.SOFT_UPDATE;
      } else {
        updateType = UPDATE_TYPES.NO_UPDATE;
      }
    } else {
      const currentVersion = getCurrentAppVersion();
      const { latestVersion, minimumVersion } = APP_UPDATE_CONFIG;

      if (compareVersions(currentVersion, minimumVersion) < 0) {
        updateType = UPDATE_TYPES.HARD_UPDATE;
      } else if (compareVersions(currentVersion, latestVersion) < 0) {
        updateType = UPDATE_TYPES.SOFT_UPDATE;
      } else {
        updateType = UPDATE_TYPES.NO_UPDATE;
      }
    }

    // Evaluate soft update cooldown
    let shouldShowModal = false;
    if (updateType === UPDATE_TYPES.HARD_UPDATE) {
      shouldShowModal = true;
    } else if (updateType === UPDATE_TYPES.SOFT_UPDATE) {
      const inCooldown = await isSoftUpdateInCooldown();
      shouldShowModal = !inCooldown;
    }

    return {
      type: updateType,
      shouldShowModal,
      currentVersion: getCurrentAppVersion(),
      latestVersion: APP_UPDATE_CONFIG.latestVersion,
      minimumVersion: APP_UPDATE_CONFIG.minimumVersion,
      config: APP_UPDATE_CONFIG,
    };
  } catch (error) {
    console.error('Error performing update check:', error);
    // Error handling rule: Do not block shop owner on future API failure
    return {
      type: UPDATE_TYPES.NO_UPDATE,
      shouldShowModal: false,
      currentVersion: getCurrentAppVersion(),
      latestVersion: APP_UPDATE_CONFIG.latestVersion,
      minimumVersion: APP_UPDATE_CONFIG.minimumVersion,
      config: APP_UPDATE_CONFIG,
    };
  }
};
