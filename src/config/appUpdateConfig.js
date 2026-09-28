// Where the update prompt's facts come from: GET /app-config, set by an admin
// in the admin panel (Settings → App updates) per platform — latest version,
// minimum version and the store link the Update button opens.
//
// Nothing here decides whether to prompt. This is only the key the app reads
// its own block under, and a last-resort store link for Android should the
// config not carry one.
export const APP_KEY = 'owner';

export const FALLBACK_STORE_URL = {
  android: 'https://play.google.com/store/apps/details?id=com.paasora.partner',
  ios: null,
};
