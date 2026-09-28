/**
 * The version of the build actually installed — Android `versionName`, iOS
 * `CFBundleShortVersionString`. This is what the stores ship and what the admin
 * panel's latest/minimum versions are compared against.
 *
 * Not package.json: that says 0.0.1 and never changes, so every owner would
 * sit below any real minimum and be locked behind the mandatory update screen.
 *
 * Loaded defensively: react-native-device-info throws at import when its native
 * half is missing from the installed build, which would take the whole app
 * down at launch. Null here means "unknown", and the update check then shows
 * nothing.
 */
let DeviceInfo = null;
try {
  // eslint-disable-next-line global-require
  DeviceInfo = require('react-native-device-info').default;
} catch (e) {
  DeviceInfo = null;
}

export const getCurrentAppVersion = () => {
  try {
    return DeviceInfo?.getVersion() ?? null;
  } catch (e) {
    return null;
  }
};
