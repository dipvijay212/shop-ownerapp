import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_KEY, FALLBACK_STORE_URL } from '../config/appUpdateConfig';
import { getAppConfig } from '../api/endpoints/platform';
import { getCurrentAppVersion } from '../utils/appVersion';
import { compareVersions } from '../utils/versionCompare';

export const UPDATE_TYPES = {
  NO_UPDATE: 'NO_UPDATE',
  SOFT_UPDATE: 'SOFT_UPDATE',
  HARD_UPDATE: 'HARD_UPDATE',
};

const DISMISSED_TIMESTAMP_KEY = '@app_update_soft_dismissed_at';
const DISMISSED_VERSION_KEY = '@app_update_soft_dismissed_version';
const SOFT_UPDATE_COOLDOWN_HOURS = 24;

const PLATFORM = Platform.OS === 'ios' ? 'ios' : 'android';

/**
 * Whether "Maybe Later" was tapped in the last 24 hours for this same latest
 * version. A newer release always brings the prompt back.
 */
export const isSoftUpdateInCooldown = async (latestVersion) => {
  try {
    const [rawTime, version] = await Promise.all([
      AsyncStorage.getItem(DISMISSED_TIMESTAMP_KEY),
      AsyncStorage.getItem(DISMISSED_VERSION_KEY),
    ]);
    if (!rawTime || version !== latestVersion) return false;
    const dismissedTime = parseInt(rawTime, 10);
    if (isNaN(dismissedTime)) return false;
    return (Date.now() - dismissedTime) / (1000 * 60 * 60) < SOFT_UPDATE_COOLDOWN_HOURS;
  } catch (error) {
    return false;
  }
};

/** Records the shop owner tapping "Maybe Later" on a soft update. */
export const recordSoftUpdateDismissed = async (latestVersion) => {
  try {
    await AsyncStorage.setItem(DISMISSED_TIMESTAMP_KEY, Date.now().toString());
    if (latestVersion) await AsyncStorage.setItem(DISMISSED_VERSION_KEY, latestVersion);
  } catch (error) {
    // Non-fatal — worst case the soft prompt reappears next launch.
  }
};

const NONE = (currentVersion) => ({
  type: UPDATE_TYPES.NO_UPDATE,
  shouldShowModal: false,
  currentVersion,
  latestVersion: null,
  minimumVersion: null,
  storeUrl: null,
});

/**
 * Whether to ask the owner to update, from the versions and store link an
 * admin set for this app and platform (GET /app-config).
 *
 * Fails OPEN: no config, no block for this platform, no store link, or any
 * error → no prompt. A network hiccup must never lock a shop out of its orders
 * behind a mandatory update screen.
 */
export const checkAppUpdate = async () => {
  const currentVersion = getCurrentAppVersion();
  // Not knowing our own version means not knowing who is behind.
  if (!currentVersion) return NONE(currentVersion);
  try {
    const cfg = await getAppConfig();
    const release = cfg?.apps?.[APP_KEY]?.[PLATFORM];
    const storeUrl = release?.store_url || FALLBACK_STORE_URL[PLATFORM];
    if (!release?.latest_version || !release?.min_version || !storeUrl) return NONE(currentVersion);

    let type = UPDATE_TYPES.NO_UPDATE;
    if (compareVersions(currentVersion, release.min_version) < 0) type = UPDATE_TYPES.HARD_UPDATE;
    else if (compareVersions(currentVersion, release.latest_version) < 0) type = UPDATE_TYPES.SOFT_UPDATE;

    const shouldShowModal = type === UPDATE_TYPES.HARD_UPDATE
      || (type === UPDATE_TYPES.SOFT_UPDATE && !(await isSoftUpdateInCooldown(release.latest_version)));

    return {
      type,
      shouldShowModal,
      currentVersion,
      latestVersion: release.latest_version,
      minimumVersion: release.min_version,
      storeUrl,
    };
  } catch (error) {
    return NONE(currentVersion);
  }
};
