import React, { useEffect, useState } from 'react';
import {
  checkAppUpdate,
  recordSoftUpdateDismissed,
  UPDATE_TYPES,
} from '../services/appUpdateService';
import { AppUpdateModal } from './AppUpdateModal';
import { openStore } from '../utils/openStore';

/**
 * Root-level AppUpdateChecker component.
 * Performs centralized update check on app launch and manages update modal state.
 */
export const AppUpdateChecker = () => {
  const [updateState, setUpdateState] = useState({
    visible: false,
    type: UPDATE_TYPES.NO_UPDATE,
    latestVersion: '1.5.0',
    minimumVersion: '1.3.0',
    title: '',
    message: '',
  });

  useEffect(() => {
    let isMounted = true;

    const runCheck = async () => {
      const result = await checkAppUpdate();
      if (isMounted && result.shouldShowModal) {
        setUpdateState({
          visible: true,
          type: result.type,
          latestVersion: result.latestVersion,
          minimumVersion: result.minimumVersion,
          title: result.config?.title,
          message: result.config?.message,
        });
      }
    };

    // An update check must never crash the app it is checking on.
    runCheck().catch((e) => console.error('[AppUpdateChecker] update check failed', e));

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDismiss = async () => {
    await recordSoftUpdateDismissed();
    setUpdateState(prev => ({ ...prev, visible: false }));
  };

  const handleUpdate = () => {
    openStore();
  };

  if (!updateState.visible) return null;

  return (
    <AppUpdateModal
      visible={updateState.visible}
      type={updateState.type}
      latestVersion={updateState.latestVersion}
      minimumVersion={updateState.minimumVersion}
      title={updateState.title}
      message={updateState.message}
      onDismiss={handleDismiss}
      onUpdate={handleUpdate}
    />
  );
};
