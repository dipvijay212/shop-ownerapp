import React, { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  checkAppUpdate,
  recordSoftUpdateDismissed,
  UPDATE_TYPES,
} from '../services/appUpdateService';
import { AppUpdateModal } from './AppUpdateModal';
import { openStore } from '../utils/openStore';

// How often coming back to the app re-asks the server. Launch always checks.
const RECHECK_MS = 30 * 60 * 1000;

/**
 * Root-level update prompt. Versions and the store link come from the admin
 * panel via GET /app-config: below the minimum version the dialog cannot be
 * closed, below the latest version it can be put off for a day.
 */
export const AppUpdateChecker = () => {
  const [updateState, setUpdateState] = useState({
    visible: false,
    type: UPDATE_TYPES.NO_UPDATE,
    latestVersion: null,
    minimumVersion: null,
    storeUrl: null,
  });
  const lastCheckedAt = useRef(0);
  const dismissedThisSession = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const runCheck = async (force) => {
      if (!force && Date.now() - lastCheckedAt.current < RECHECK_MS) return;
      lastCheckedAt.current = Date.now();
      const result = await checkAppUpdate();
      if (!isMounted || !result.shouldShowModal) return;
      // "Maybe Later" holds for the session; a mandatory update always shows.
      if (dismissedThisSession.current && result.type === UPDATE_TYPES.SOFT_UPDATE) return;
      setUpdateState({
        visible: true,
        type: result.type,
        latestVersion: result.latestVersion,
        minimumVersion: result.minimumVersion,
        storeUrl: result.storeUrl,
      });
    };

    // An update check must never crash the app it is checking on.
    runCheck(true).catch(() => {});
    // Also on return to the app, so raising the minimum reaches an owner who
    // leaves it open all day on the counter.
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') runCheck(false).catch(() => {});
    });

    return () => {
      isMounted = false;
      sub.remove();
    };
  }, []);

  const handleDismiss = async () => {
    dismissedThisSession.current = true;
    await recordSoftUpdateDismissed(updateState.latestVersion);
    setUpdateState(prev => ({ ...prev, visible: false }));
  };

  const handleUpdate = () => {
    openStore(updateState.storeUrl);
  };

  if (!updateState.visible) return null;

  return (
    <AppUpdateModal
      visible={updateState.visible}
      type={updateState.type}
      latestVersion={updateState.latestVersion}
      minimumVersion={updateState.minimumVersion}
      onDismiss={handleDismiss}
      onUpdate={handleUpdate}
    />
  );
};

export default AppUpdateChecker;
