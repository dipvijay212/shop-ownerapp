import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export const getCurrentLocation = () => {
  return new Promise(async (resolve, reject) => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);
        
        if (
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] !== PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] !== PermissionsAndroid.RESULTS.GRANTED
        ) {
          console.warn('Location permission denied');
          return reject(new Error('Location permission denied'));
        }
      } catch (err) {
        console.warn('Permission error:', err);
        return reject(err);
      }
    } else {
      // For iOS, explicitly request authorization
      Geolocation.requestAuthorization();
    }

    const fetchPosition = (highAccuracy) => {
      return new Promise((res, rej) => {
        Geolocation.getCurrentPosition(
          (position) => {
            res({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          (error) => {
            rej(error);
          },
          { enableHighAccuracy: highAccuracy, timeout: 15000, maximumAge: 10000 }
        );
      });
    };

    try {
      // Try high accuracy first (solves Emulator issues and outdoor physical devices)
      const loc = await fetchPosition(true);
      resolve(loc);
    } catch (highAccuracyError) {
      console.warn('High accuracy failed, falling back to low accuracy...', highAccuracyError);
      try {
        // Fallback to low accuracy (solves indoor physical devices using Wifi/Cellular)
        const loc = await fetchPosition(false);
        resolve(loc);
      } catch (lowAccuracyError) {
        console.warn('Both location strategies failed:', lowAccuracyError);
        reject(lowAccuracyError);
      }
    }
  });
};
