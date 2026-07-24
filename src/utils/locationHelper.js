import { Platform, Alert, Linking } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { promptForEnableLocationIfNeeded } from 'react-native-android-location-enabler';
import Geolocation from '@react-native-community/geolocation';

export const ensureLocationReady = () => {
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
          'Location Permission Required',
          'We need your location to find shops near you. Please enable it in settings.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => reject(new Error('Permission denied')) },
            { text: 'Open Settings', onPress: () => { Linking.openSettings(); reject(new Error('Opened settings')); } }
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
              'Location Services Disabled',
              'Please turn on Location Services in Settings > Privacy > Location Services.',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => reject(lowAccErr) },
                { text: 'Open Settings', onPress: () => { Linking.openSettings(); reject(lowAccErr); } }
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
