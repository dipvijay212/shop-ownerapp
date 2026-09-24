import { ensureLocationReady } from './locationHelper';

export const DEFAULT_LOCATION = {
  latitude: 21.2401,
  longitude: 72.8735,
};

/**
 * Prompts user to enable location services if needed, requests permissions,
 * and fetches high/low accuracy GPS position.
 * Returns default center if location is disabled or unavailable.
 */
export const getCurrentLocation = async (t) => {
  try {
    const loc = await ensureLocationReady(t);
    if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
      return loc;
    }
    return DEFAULT_LOCATION;
  } catch (err) {
    console.log('getCurrentLocation: using default location fallback:', err?.message || err);
    return DEFAULT_LOCATION;
  }
};
