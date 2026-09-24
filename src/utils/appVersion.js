import appJson from '../../package.json';

/**
 * Dynamically fetches the current app version.
 * Source of truth is package.json (or native device info if integrated later).
 */
export const getCurrentAppVersion = () => {
  return appJson?.version || '0.0.1';
};
