import { Platform, Alert, Linking } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { promptForEnableLocationIfNeeded } from 'react-native-android-location-enabler';
import Geolocation from '@react-native-community/geolocation';

// The alerts below are customer-facing, so they need the active language. This
// util has no hook of its own — the calling screen threads its `t` in (via
// getCurrentLocation). `t` is optional so an older caller still renders copy
// rather than crashing.
export const ensureLocationReady = (t = (k, fallback) => fallback ?? k) => {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Check & Request Permissions
      console.log('[LocationHelper] 1. Checking permissions...');
      const permission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

      let permStatus = await check(permission);
      console.log('[LocationHelper] permStatus initial:', permStatus);
      
      if (permStatus === RESULTS.DENIED) {
        console.log('[LocationHelper] Requesting permission...');
        permStatus = await request(permission);
        console.log('[LocationHelper] permStatus after request:', permStatus);
      }

      if (permStatus === RESULTS.BLOCKED || permStatus === RESULTS.DENIED) {
        Alert.alert(
          t('locPermTitle', 'Location Permission Required'),
          t('locPermBody', 'We need your location to find shops near you. Please enable it in settings.'),
          [
            { text: t('cancel', 'Cancel'), style: 'cancel', onPress: () => reject(new Error('Permission denied')) },
            { text: t('openSettingsBtn', 'Open Settings'), onPress: () => { Linking.openSettings(); reject(new Error('Opened settings')); } }
          ]
        );
        return; // Early return, rejected in onPress
      }

      if (permStatus !== RESULTS.GRANTED) {
        return reject(new Error('Permission not granted'));
      }

      // 2. Check & Enable Location Services (GPS)
      if (Platform.OS === 'android') {
        console.log('[LocationHelper] 2. Checking location services on Android...');
        try {
          const enableResult = await promptForEnableLocationIfNeeded({
            interval: 10000,
            waitForAccurate: true,
          });
          console.log('[LocationHelper] enableResult:', enableResult);
        } catch (error) {
          // User denied the dialog or it failed
          console.warn('[LocationHelper] promptForEnableLocationIfNeeded failed:', error);
          return reject(new Error('Location services not enabled: ' + error.message));
        }
      }

      // 3. Fetch Position
      console.log('[LocationHelper] 3. Fetching actual GPS position...');
      
      const fetchPos = (highAccuracy) => new Promise((res, rej) => {
        Geolocation.getCurrentPosition(
          res,
          rej,
          { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 5000 : 10000, maximumAge: 60000 }
        );
      });

      try {
        const position = await fetchPos(true);
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      } catch (highAccErr) {
        console.warn('[LocationHelper] High accuracy failed:', highAccErr);
        try {
          const position = await fetchPos(false);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        } catch (lowAccErr) {
          console.warn('[LocationHelper] Low accuracy failed:', lowAccErr);
          if (Platform.OS === 'ios' && lowAccErr.code === 2) { // POSITION_UNAVAILABLE
            Alert.alert(
              t('locServicesDisabled', 'Location Services Disabled'),
              t('locServicesDisabledBody', 'Please turn on Location Services in Settings > Privacy > Location Services.'),
              [
                { text: t('cancel', 'Cancel'), style: 'cancel', onPress: () => reject(lowAccErr) },
                { text: t('openSettingsBtn', 'Open Settings'), onPress: () => { Linking.openSettings(); reject(lowAccErr); } }
              ]
            );
          } else {
            reject(lowAccErr);
          }
        }
      }

    } catch (e) {
      reject(e);
    }
  });
};
