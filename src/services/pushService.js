// Push notifications (FCM): permission, device registration, and what a
// tapped notification does.
//
// The backend sends notification messages (title/body plus a string-only
// `data` map), which the OS draws by itself whenever the app is not in the
// foreground. So nothing here builds a notification. This module keeps the
// server's device_tokens row in step with whoever is signed in, and maps a
// message's `data.type` to an action. The Android channel each type is posted
// on (new orders get their own, loudest one) is chosen server-side in
// localmart-backend push-channels.ts and created in MainApplication.kt.

import { AppState, PermissionsAndroid, Platform } from 'react-native';
import {
  deleteToken,
  getAPNSToken,
  getMessaging,
  getToken,
  isDeviceRegisteredForRemoteMessages,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
} from '@react-native-firebase/messaging';
import { api } from '../api';
import { getRefreshToken } from '../api/session';
import { navigationRef } from '../navigation/navigationRef';

// DeviceEventEmitter event carrying a foreground message's `data`, for screens
// that keep their own state instead of a query cache (OrdersScreen).
export const PUSH_RECEIVED = 'push:received';

// Logout waits on the server call below, and a phone on a bad connection must
// not be stuck on the logout button because of it.
const UNREGISTER_TIMEOUT_MS = 4000;

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

// Android shows one permission dialog at a time, and a request made while
// another is on screen is answered "denied" without the user ever seeing it.
// A sign-in lands on a screen that asks for location as it opens, so the
// prompt waits until the app has sat in the foreground, undisturbed, for a
// moment. A system dialog pauses the activity, which AppState reports as
// 'background', and that restarts the wait.
const FOREGROUND_SETTLE_MS = 2500;

const whenForegroundSettles = () =>
  new Promise((resolve) => {
    let timer = null;
    const arm = () => {
      clearTimeout(timer);
      if (AppState.currentState !== 'active') return;
      timer = setTimeout(() => {
        sub.remove();
        resolve();
      }, FOREGROUND_SETTLE_MS);
    };
    const sub = AppState.addEventListener('change', arm);
    arm();
  });

// Asked on each sign-in or launch until answered. Android keeps its own count:
// after a second refusal it stops showing the dialog and answers at once, so
// this costs at most one repeat prompt. Refusing only hides the notifications:
// the token is still registered, so turning them on later in system settings
// needs no re-login.
const askAndroidPermission = async () => {
  // Below Android 13 notifications are on by default and there is no prompt.
  if (Platform.Version < 33) return;
  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) return;
  await whenForegroundSettles();
  await PermissionsAndroid.request(permission);
};

// ── iOS: there is no token until APNs has answered ──────────────────────
//
// Android hands out an FCM token on the first call whatever the permission
// dialog is doing, so the prompt can be left running in the background. iOS
// has no FCM token at all until APNs has issued a device token, which needs
// registerForRemoteNotifications plus a round trip to Apple. A getToken()
// fired before that rejects with "No APNS token specified before fetching FCM
// Token" — and because the rejection was only logged and never retried, no
// iPhone ever reached device_tokens. Every push the backend sent then had no
// iOS address to deliver to, which is why alerts appeared only in the app's
// own alert centre and never on the phone.
const IOS_PERMISSION_TIMEOUT_MS = 30000;
const APNS_TOKEN_TIMEOUT_MS = 15000;
const APNS_POLL_MS = 250;

const whenApnsTokenArrives = async (messaging) => {
  const deadline = Date.now() + APNS_TOKEN_TIMEOUT_MS;
  for (;;) {
    if (await getAPNSToken(messaging).catch(() => null)) return;
    if (Date.now() >= deadline) throw new Error('APNs token did not arrive');
    await new Promise((resolve) => setTimeout(resolve, APNS_POLL_MS));
  }
};

// The iOS prompt IS awaited, unlike Android's: an iPhone draws nothing until
// it is answered. It is bounded so an unanswered dialog cannot strand the
// registration, and a refusal is not fatal — APNs issues a device token
// either way, so registering it keeps the same property Android has, that
// switching notifications on later in Settings needs no re-login.
const prepareIosPush = async (messaging) => {
  // Asked even where the rest of this cannot succeed: the authorization is
  // what lets notifee draw, and what lets an `xcrun simctl push` appear at
  // all. Without it a simulator shows nothing either, which reads as the same
  // bug for a quite different reason.
  await withTimeout(requestPermission(messaging), IOS_PERMISSION_TIMEOUT_MS).catch(() => {});
  // Firebase's app-delegate swizzling normally registers at launch; this is a
  // no-op when that already happened, and covers a build with the proxy off.
  if (!isDeviceRegisteredForRemoteMessages(messaging)) {
    await registerDeviceForRemoteMessages(messaging);
  }
  await whenApnsTokenArrives(messaging);
};

// RNFirebase will not ask APNs for a token on an ARM64 simulator — it skips
// the UIKit call outright and lets its own ten-second timer reject (see
// RNFBMessagingModule.mm, "Use a physical device for real APNs tokens"). That
// is a permanent property of the target, not a flaky call: retrying only
// spends another ten seconds to fail the same way. Callers use this to stop
// rather than back off.
export const isApnsUnavailable = (e) => {
  const code = `${e?.code || ''} ${e?.message || ''}`;
  return code.includes('messaging/registration-timeout');
};

let refreshSubscribed = false;

// Registers this device for the signed-in owner. Safe on every launch: the
// server upserts by token, which also moves a token between accounts when a
// different person signs in on the same phone.
export const registerForPush = async () => {
  const messaging = getMessaging();

  if (Platform.OS === 'ios') {
    await prepareIosPush(messaging);
  } else {
    // Not awaited: the prompt can wait on the user indefinitely, and the
    // token is worth registering either way.
    askAndroidPermission().catch(() => {});
  }

  const token = await getToken(messaging);
  await api.notifications.registerDevice(token, Platform.OS);

  if (!refreshSubscribed) {
    refreshSubscribed = true;
    // FCM rotates a token now and then (app data cleared, backup restored to
    // a new phone). The listener lives as long as the process, logouts
    // included, so it only re-registers while there is a session to do it with.
    onTokenRefresh(messaging, (next) => {
      if (!getRefreshToken()) return;
      api.notifications.registerDevice(next, Platform.OS).catch(() => {});
    });
  }
};

// Logout, while the session is still valid. The server row goes first, so the
// next person to sign in on this phone does not receive this shop's orders.
// Deleting the token afterwards kills it outright, which covers a DELETE that
// never reached the server.
export const unregisterFromPush = async () => {
  const messaging = getMessaging();
  try {
    const token = await withTimeout(getToken(messaging), UNREGISTER_TIMEOUT_MS);
    await withTimeout(api.notifications.unregisterDevice(token), UNREGISTER_TIMEOUT_MS);
  } catch (e) {
    // Offline or slow: the deleteToken below still stops delivery.
  }
  await withTimeout(deleteToken(messaging), UNREGISTER_TIMEOUT_MS).catch(() => {});
};

// The session is already gone (a refresh failed), so the API cannot be told.
// Deleting the token stops delivery; the backend prunes the dead row the next
// time a send to it fails.
export const dropPushToken = () => deleteToken(getMessaging()).catch(() => {});

// ── foreground notifications ────────────────────────────────────────────────
//
// FCM only lets the OS draw a notification when the app is NOT in the
// foreground. For a shop owner that is exactly backwards: the app sits open on
// Orders Management all day with the phone on the counter, which is precisely
// when a new order must be impossible to miss — and precisely when nothing
// appeared. Notifee posts the same notification ourselves so it arrives as a
// real heads-up, on the same channel the server chose.

// The channel the server picked, as RNFirebase surfaces it. An id the device
// does not know would make notifee throw, and MainApplication.kt creates all
// four, so an unknown one falls back to the one that always exists.
const KNOWN_CHANNELS = ['new_orders', 'orders', 'account', 'general'];

const channelOf = (message) => {
  const id = message?.notification?.android?.channelId;
  return KNOWN_CHANNELS.includes(id) ? id : 'general';
};

/**
 * Draws a foreground message as a system notification. Rejects when the native
 * module is missing — an APK built before notifee was added — and the caller
 * falls back to the in-app banner, so an old build degrades instead of going
 * silent.
 */
export const displayForegroundNotification = async (message) => {
  const notifee = require('@notifee/react-native').default;
  const { title, body } = message?.notification || {};
  if (!title && !body) throw new Error('data-only message — nothing to draw');
  await notifee.displayNotification({
    title,
    body,
    data: message?.data || {},
    android: {
      channelId: channelOf(message),
      // Matches the icon FCM uses for the same notification when the app is
      // backgrounded, so the two look identical in the tray.
      smallIcon: 'ic_notification',
      color: '#16A34A',
      pressAction: { id: 'default' },
      autoCancel: true,
    },
    // Named explicitly or the foreground notification arrives silently on
    // iOS: notifee plays a sound only when the notification carries one.
    // Matches the `sound: 'default'` the backend puts in the APNs payload for
    // the same notification when the app is in the background.
    ios: { sound: 'default' },
  });
};

const tab = (screen, params) => ({ name: 'MainTabs', params: { screen, params } });

// What a notification does, from its `data` (every value a string, as FCM
// delivers them):
//   route               where to navigate, if that stack is mounted
//   refreshShop         re-read the shop; RootNavigator picks the stack from
//                       its status, so for approval notices that IS the navigation
//   refreshSubscription re-read the plan, so the expiry banner is current
export const actionForNotification = (data = {}) => {
  switch (data.type) {
    case 'order_new':
    case 'order_cancelled':
    case 'khata_charge':
      // The round reminder is an order_new with no order behind it: it is
      // about today's subscription deliveries, which live on that tab.
      return data.order_id
        ? { route: tab('Orders', { openOrderId: data.order_id }) }
        : { route: tab('Subscriptions') };
    // A customer asking for khata is the one notification with a decision
    // waiting behind it. The requests list lives on Customers, which is a root
    // stack screen rather than a tab.
    case 'khata_request':
      return { route: { name: 'Customers' } };
    case 'subscription_new':
    case 'standing_order_cancelled':
    // A customer asking for a different quantity — the request waits on top of the round.
    case 'standing_order_change_requested':
      return { route: tab('Subscriptions') };
    // The shop's own status decides which stack RootNavigator mounts, so the
    // refresh IS most of the navigation. It is awaited before the route below
    // is taken, or the destination would still be on the stack being replaced.
    case 'shop_approved':
      return { refreshShop: true, route: { name: 'ShopStatus' } };
    case 'shop_rejected':
      // Straight to where the documents are re-submitted — the owner cannot do
      // anything about a rejection except send the papers again.
      return { refreshShop: true, route: { name: 'DocumentUpload' } };
    case 'plan_expired':
    case 'plan_expiring':
    case 'trial_ending':
      return { refreshSubscription: true, route: { name: 'SubscriptionPayment' } };
    case 'plan_renewed':
      return { refreshSubscription: true, route: tab('Dashboard') };
    default:
      return { route: tab('Dashboard') };
  }
};

// Carries out actionForNotification. Shared by a tapped push and a tapped card
// in the Dashboard's alert centre, so the two cannot drift apart.
export const runNotificationAction = async (data, { refreshShop, refreshSubscription }) => {
  const { route, ...effects } = actionForNotification(data);
  if (effects.refreshSubscription) refreshSubscription();
  // Awaited, not fired and forgotten: an approval or a rejection changes the
  // shop's status, RootNavigator swaps the whole stack on the back of it, and
  // a navigate issued before that lands on a stack that is about to go away.
  if (effects.refreshShop) {
    await refreshShop().catch(() => {});
  }
  // Only into a stack that is mounted: an owner whose shop is still pending
  // has no MainTabs, and navigating there would do nothing but log a warning.
  if (route && navigationRef.getRootState()?.routeNames?.includes(route.name)) {
    navigationRef.navigate(route.name, route.params);
  }
};
