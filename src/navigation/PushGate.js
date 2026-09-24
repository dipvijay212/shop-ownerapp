// Push notifications, from the app's side of the tray.
//
// Renders only the in-app banner. It sits inside NavigationContainer because
// a tapped notification is delivered by the OS, not by a screen, so it acts
// through `navigationRef` and has to wait for a navigator to exist.
//
// The three app states map onto three FCM callbacks:
//
//   app killed      → getInitialNotification()   the tap launched the app
//   app background  → onNotificationOpenedApp    the tap resumed it
//   app foreground  → onMessage                  the OS draws nothing here, so
//                                                we post the notification
//                                                ourselves (notifee)
//
// A tap is kept in state until the navigator can take it: on a cold start the
// splash renders no navigator at all, and `navReadyTick` is what re-runs the
// effect once one appears.

import React, { useCallback, useContext, useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import {
  getInitialNotification,
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
} from '@react-native-firebase/messaging';
import { api } from '../api';
import { AuthContext } from '../context/AuthContext';
import { PushBanner } from '../components/PushBanner';
import {
  PUSH_RECEIVED,
  actionForNotification,
  displayForegroundNotification,
  isApnsUnavailable,
  registerForPush,
  runNotificationAction,
} from '../services/pushService';
import { navigationRef } from './navigationRef';

// On Android a background tap reaches JS twice: the library fires
// onNotificationOpenedApp AND keeps the message as its "initial notification",
// so any later getInitialNotification() (a remount, a reload) returns the
// same tap and would navigate a second time. Module scope, so a remount of
// the component does not forget what it already handled.
const handledTaps = new Set();
const firstTimeTap = (message) => {
  if (!message) return null;
  if (message.messageId) {
    if (handledTaps.has(message.messageId)) return null;
    handledTaps.add(message.messageId);
  }
  return message;
};

export const PushGate = ({ navReadyTick }) => {
  const {
    isLoading,
    userToken,
    refreshCounters,
    refreshShop,
    refreshSubscription,
  } = useContext(AuthContext);
  // A message whose notification was tapped, waiting for a navigator.
  const [tapped, setTapped] = useState(null);
  const [banner, setBanner] = useState(null);

  // Every session start registers: a fresh login, and also a launch that
  // restored a session, or an owner signed in before this build shipped would
  // never get a device row at all.
  useEffect(() => {
    if (!userToken) return undefined;
    let cancelled = false;
    let timer = null;
    // Retried, because a first attempt fails for reasons that pass: on iOS
    // the APNs round trip is slow on a poor connection, and the permission
    // dialog may still be on screen. One warn and no retry is how a phone
    // ends up permanently absent from device_tokens.
    const attempt = (n) => {
      registerForPush().catch((e) => {
        if (cancelled) return;
        // The simulator can never produce a token, so say so once instead of
        // spending four more ten-second timeouts proving it again.
        if (isApnsUnavailable(e)) {
          console.warn(
            '[push] no APNs token on this target (iOS simulator): real pushes ' +
              'cannot arrive. Test notifications with `npm run push:sim`, or ' +
              'use a physical device for the full pipeline.',
          );
          return;
        }
        console.warn(`[push] registration failed (attempt ${n}):`, e?.message);
        if (n >= 4) return;
        timer = setTimeout(() => attempt(n + 1), n * 5000);
      });
    };
    attempt(1);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userToken]);

  useEffect(() => {
    const messaging = getMessaging();
    const take = (message) => {
      const tap = firstTimeTap(message);
      if (tap) setTapped(tap);
    };
    getInitialNotification(messaging).then(take).catch(() => {});
    return onNotificationOpenedApp(messaging, take);
  }, []);

  // Separate from the tap listeners: refreshCounters changes identity with
  // every sign-in, and only this subscription needs to follow it.
  useEffect(() => {
    const offMessage = onMessage(getMessaging(), (message) => {
      const data = message.data || {};
      // A real heads-up, not just an in-app strip: an owner with the app open
      // on the counter has to see a new order the same way they see a text.
      // The banner stays as the fallback for a build without the native
      // module, so an old APK degrades quietly instead of going silent.
      displayForegroundNotification(message).catch(() => setBanner(message));
      refreshCounters();
      // State the message changes even if nobody taps it: an approval flips
      // which stack RootNavigator shows, a renewal clears the expiry banner.
      const effects = actionForNotification(data);
      if (effects.refreshShop) refreshShop().catch(() => {});
      if (effects.refreshSubscription) refreshSubscription();
      DeviceEventEmitter.emit(PUSH_RECEIVED, data);
    });
    return offMessage;
  }, [refreshCounters, refreshShop, refreshSubscription]);

  // Notifee delivers presses on the notifications WE posted; FCM's own
  // listeners never see them, so without this a foreground notification would
  // open the app and land nowhere.
  useEffect(() => {
    let notifee;
    try {
      notifee = require('@notifee/react-native');
    } catch (e) {
      return undefined; // build without the native module
    }
    const { EventType } = notifee;
    return notifee.default.onForegroundEvent(({ type, detail }) => {
      if (type !== EventType.PRESS) return;
      const data = detail.notification?.data;
      if (data) setTapped({ data, messageId: detail.notification?.id });
    });
  }, []);

  useEffect(() => {
    if (!tapped || isLoading || !navigationRef.isReady()) return;
    setTapped(null);
    // Signed out since it was sent: there is nothing of theirs to open.
    if (!userToken) return;

    const data = tapped.data || {};
    if (data.notification_id) {
      api.notifications.markRead(data.notification_id).then(refreshCounters).catch(() => {});
    }
    // Async since an approval has to refresh the shop before navigating;
    // nothing here waits on it, so the rejection is swallowed explicitly.
    runNotificationAction(data, { refreshShop, refreshSubscription }).catch(() => {});
  }, [tapped, isLoading, userToken, navReadyTick, refreshCounters, refreshShop, refreshSubscription]);

  const dismissBanner = useCallback(() => setBanner(null), []);
  const openBanner = useCallback(() => {
    setTapped(banner);
    setBanner(null);
  }, [banner]);

  return <PushBanner message={banner} onPress={openBanner} onDismiss={dismissBanner} />;
};

export default PushGate;
