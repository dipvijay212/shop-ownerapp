import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';
import { ownerAuthService } from '../services/ownerAuthService';
import {
  clearSession,
  getAccessToken,
  loadSession,
  onSessionExpired,
  saveOwner,
  saveShop,
  saveTokens,
} from '../api/session';
import { useQueryClient } from '@tanstack/react-query';
import { dropPushToken, unregisterFromPush } from '../services/pushService';

export const AuthContext = createContext();

// Where the owner lands after auth, driven entirely by GET /owner/shop (§2.3).
export const SHOP_ROUTE = {
  ONBOARDING: 'onboarding', // no shop yet, or status 'draft'
  PENDING: 'pending', // pending_verification → waiting screen
  REJECTED: 'rejected', // show rejection_reason + Edit & Resubmit
  DASHBOARD: 'dashboard', // approved
  SUSPENDED: 'suspended', // blocking notice
};

// The only values GET /owner/shop can return for `status`.
export const SHOP_STATUSES = [
  'draft',
  'pending_verification',
  'rejected',
  'approved',
  'suspended',
];

export const routeForShop = (shop) => {
  if (!shop || shop.status === 'draft') return SHOP_ROUTE.ONBOARDING;
  switch (shop.status) {
    case 'pending_verification':
      return SHOP_ROUTE.PENDING;
    case 'rejected':
      return SHOP_ROUTE.REJECTED;
    case 'suspended':
      return SHOP_ROUTE.SUSPENDED;
    case 'approved':
      return SHOP_ROUTE.DASHBOARD;
    default:
      // A shop object exists, so this owner has definitely registered — an
      // unrecognised status is bad data, not a missing shop. Onboarding is the
      // worst possible guess here: it hides a real shop behind a wizard the
      // owner cannot escape. The status screen is read-only and offers a way
      // out, so fail towards that instead.
      return SHOP_ROUTE.PENDING;
  }
};

// The picker selects straight from GET /owner/shop-categories, so this is only
// a shape guard: the API takes public ids, and a name would fail server-side
// with a far less obvious message.
const resolveCategoryIds = (selected) => {
  const ids = (selected || [])
    .filter(Boolean)
    .map((v) => (typeof v === 'object' ? v.id : v))
    .filter((v) => typeof v === 'string' && v.startsWith('sct_'));

  if (ids.length === 0) {
    throw new Error('Please select at least one shop category.');
  }
  return ids;
};

export const AuthProvider = ({ children }) => {
  const queryClient = useQueryClient();
  // Shown in place of the auth stack right after a deletion request locks the
  // account: { requestNo }. The server has already ended every session, so
  // the message cannot live on an authed screen — the first background 401
  // would unmount it.
  const [accountNotice, setAccountNotice] = useState(null);
  const deletionLockedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [owner, setOwner] = useState(null);
  const [shop, setShop] = useState(null);
  // `shop === null` is ambiguous on its own — it means both "the server says
  // this owner has no shop" and "we never got an answer". Only the first may
  // route to onboarding, so track which one we're in.
  const [shopKnown, setShopKnown] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [appLanguage, setAppLanguageState] = useState('en');
  // Whether a language has ever been CHOSEN, as opposed to defaulting to 'en'.
  // The picker is the first screen at launch until it has been, so this cannot
  // be inferred from `appLanguage`.
  const [languageChosen, setLanguageChosen] = useState(false);

  // Dashboard badges.
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  // New subscriptions the owner has not opened the round to look at yet.
  const [newSubscriptionsCount, setNewSubscriptionsCount] = useState(0);
  // Khata requests still waiting on an approve/reject. Unlike the subscription
  // dot this one has no "clear" — it is a queue of work, not an announcement,
  // so it stays lit until the owner actually decides each one.
  const [pendingKhataCount, setPendingKhataCount] = useState(0);
  // Quantity changes customers asked for. Like khata requests, a queue of
  // work: opening the screen does not answer them, so it never clears the dot.
  const [pendingChangeRequests, setPendingChangeRequests] = useState(0);
  const [subscription, setSubscription] = useState(null);

  const refreshTokenRef = useRef(null);

  const shopRoute = routeForShop(shop);

  // --- Bootstrap ------------------------------------------------------------

  useEffect(() => {
    const bootstrap = async () => {
      const minSplash = new Promise((resolve) => setTimeout(resolve, 1800));

      const init = (async () => {
        try {
          const storedLang = await AsyncStorage.getItem('owner_preferred_language');
          if (storedLang) {
            setAppLanguageState(storedLang);
            setLanguageChosen(true);
          }

          const session = await loadSession();
          refreshTokenRef.current = session.refreshToken;

          if (!session.accessToken && !session.refreshToken) return;

          if (session.owner) setOwner(session.owner);
          if (session.shop) setShop(session.shop);
          setUserToken(session.accessToken || session.refreshToken);

          // allSettled, not all: these are independent reads, and a failing
          // /owner/me must not discard a perfectly good /owner/shop response —
          // that used to leave `shop` null and route an approved owner into
          // the onboarding wizard.
          const [profileRes, shopRes] = await Promise.allSettled([
            api.auth.getOwnerProfile(),
            ownerAuthService.getShop(),
          ]);

          if (profileRes.status === 'fulfilled') {
            const profile = profileRes.value;
            setOwner(profile);
            await saveOwner(profile);
            await reconcileLanguage(profile.language, storedLang);
          }

          if (shopRes.status === 'fulfilled') {
            // Authoritative — including a confirmed null, which really does
            // mean "no shop yet, start onboarding".
            setShop(shopRes.value);
            setShopKnown(true);
            await saveShop(shopRes.value);
          }

          const failure =
            profileRes.status === 'rejected'
              ? profileRes.reason
              : shopRes.status === 'rejected'
                ? shopRes.reason
                : null;

          if (!failure) {
            setIsOffline(false);
          } else if (failure.isNetworkError) {
            // Work from the cached owner/shop until the network returns.
            setIsOffline(true);
          } else if (failure.status === 401) {
            await clearSession();
            setUserToken(null);
            setOwner(null);
            setShop(null);
            setShopKnown(false);
          }
        } catch (e) {
          console.error('[AuthContext] bootstrap failed', e);
        }
      })();

      await Promise.all([init, minSplash]);
      setIsLoading(false);
    };

    // Fire-and-forget, so it needs its own handler: an unhandled rejection here
    // surfaces as a stackless "Uncaught (in promise)" red box that names neither
    // the screen nor the call. Never leave the splash up on failure.
    bootstrap().catch((e) => {
      console.error('[AuthContext] bootstrap rejected', e);
      setIsLoading(false);
    });
  }, []);

  useEffect(
    () =>
      onSessionExpired(() => {
        // Too late to tell the server (no session left to do it with), so
        // kill the token itself — otherwise this phone keeps receiving the
        // previous owner's orders. Not after a deletion request, though: the
        // device stays registered so "your account was resumed" can reach it.
        if (!deletionLockedRef.current) dropPushToken();
        setUserToken(null);
        setOwner(null);
        setShop(null);
        // Must reset with the session, or the next owner to sign in inherits a
        // stale "we know their shop state" flag.
        setShopKnown(false);
        setNewOrdersCount(0);
        setUnreadCount(0);
        setNewSubscriptionsCount(0);
        setPendingKhataCount(0);
      }),
    [],
  );

  // --- Shop -----------------------------------------------------------------

  // Call on every app open and after any wizard step, approval poll or
  // online/offline toggle — it is the source of truth for routing.
  // Device choice beats account setting; a device that has never chosen one
  // adopts the account's. So whoever signs in on this phone gets the language
  // the phone is set to — including a number that has never used the app —
  // and that choice is pushed up to their profile.
  const reconcileLanguage = useCallback(async (accountLang, deviceLang) => {
    if (deviceLang) {
      setAppLanguageState(deviceLang);
      setLanguageChosen(true);
      if (accountLang !== deviceLang) {
        api.auth.updateOwnerProfile({ language: deviceLang }).catch(() => {});
      }
      return;
    }
    if (accountLang) {
      await AsyncStorage.setItem('owner_preferred_language', accountLang);
      setAppLanguageState(accountLang);
      setLanguageChosen(true);
    }
  }, []);

  const refreshShop = useCallback(async () => {
    const shopData = await ownerAuthService.getShop();
    setShop(shopData);
    setShopKnown(true);
    await saveShop(shopData);
    return shopData;
  }, []);

  // Several screens still hand this mock shop objects whose `status` is
  // 'active'/'inactive' — values the API never returns. `status` is the single
  // field RootNavigator routes on, so a bad one silently teleports the owner
  // out of the app they were using. Merge everything else, but only accept a
  // status the API can actually produce.
  const updateShopState = useCallback(
    async (updatedShop) => {
      if (!updatedShop) return;
      const status = SHOP_STATUSES.includes(updatedShop.status) ? updatedShop.status : shop?.status;
      const merged = { ...shop, ...updatedShop, status };
      setShop(merged);
      await saveShop(merged);
    },
    [shop],
  );

  const updateOwnerState = useCallback(async (updatedOwner) => {
    setOwner(updatedOwner);
    await saveOwner(updatedOwner);
  }, []);

  // --- Badges ---------------------------------------------------------------

  // When the round was last opened. A poll that left before the owner looked
  // comes back with the pre-clear count, and applying it re-lit the dot for up
  // to another 30 seconds — so its answer is thrown away rather than believed.
  const subsSeenAtRef = useRef(0);

  // Opening the round IS having seen what is in it. Called from the round
  // screen on focus; the server clear follows and stamps this again.
  const markSubscriptionsSeen = useCallback(() => {
    subsSeenAtRef.current = Date.now();
    setNewSubscriptionsCount(0);
  }, []);

  // Replaces the old 4-second AsyncStorage poll with the real counters.
  const refreshCounters = useCallback(async () => {
    if (!userToken) return;
    const startedAt = Date.now();
    try {
      const [dash, unread, unseenSubs, pendingKhata] = await Promise.all([
        api.business.getDashboard().catch(() => null),
        api.notifications.getUnreadCount().catch(() => null),
        api.subscriptions.getUnseenCount().catch(() => null),
        api.khata.getPendingRequestCount().catch(() => null),
      ]);
      if (dash?.counters) setNewOrdersCount(dash.counters.new || 0);
      if (unread) setUnreadCount(unread.unread_count || 0);
      if (unseenSubs && subsSeenAtRef.current < startedAt) {
        setNewSubscriptionsCount(unseenSubs.count || 0);
      }
      if (unseenSubs) setPendingChangeRequests(unseenSubs.change_requests || 0);
      if (pendingKhata) setPendingKhataCount(pendingKhata.count || 0);
    } catch (e) {
      // Badge refresh must never surface an error to the user.
    }
  }, [userToken]);

  const refreshSubscription = useCallback(async () => {
    try {
      const sub = await api.business.getSubscription();
      setSubscription(sub);
      return sub;
    } catch (e) {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!userToken || shopRoute !== SHOP_ROUTE.DASHBOARD) return undefined;
    refreshCounters();
    const interval = setInterval(refreshCounters, 30000);
    return () => clearInterval(interval);
  }, [userToken, shopRoute, refreshCounters]);

  // --- Auth actions ---------------------------------------------------------

  // Called after ownerAuthService.verifyOtp has persisted the token pair.
  const login = useCallback(async (authPayload) => {
    deletionLockedRef.current = false;
    if (authPayload?.access_token) {
      await saveTokens(authPayload);
      refreshTokenRef.current = authPayload?.refresh_token || refreshTokenRef.current;
    }

    const [profileRes, shopRes] = await Promise.allSettled([
      api.auth.getOwnerProfile(),
      ownerAuthService.getShop(),
    ]);

    if (profileRes.status === 'fulfilled') {
      const profile = profileRes.value;
      setOwner(profile);
      await saveOwner(profile);
      const deviceLang = await AsyncStorage.getItem('owner_preferred_language');
      await reconcileLanguage(profile.language, deviceLang);
    }

    // Only a resolved read is authoritative. Swallowing the rejection into
    // null here is what made a timeout look identical to "no shop yet" and
    // sent owners with an approved shop back through onboarding.
    if (shopRes.status === 'fulfilled') {
      setShop(shopRes.value);
      setShopKnown(true);
      await saveShop(shopRes.value);
    }

    // Set the token last so the navigator swaps once shop state is known and
    // routing lands on the right screen first time.
    setUserToken(authPayload?.access_token || getAccessToken() || 'session');
  }, []);

  // Onboarding wizard submit (O-03 → O-06).
  //
  // The wizard collects everything up front and commits at the end, but the
  // API models it as four ordered calls. Kept here rather than in the screen so
  // the ordering — and the fact that the shop must exist before its delivery
  // zone can be set — lives in one place.
  const registerShop = useCallback(
    async (form) => {
      // 1 · Step 1 — owner personal details.
      await api.auth.updateOwnerProfile({
        full_name: form.name,
        email: form.email || undefined,
      });

      // 2 · Banner upload, if the owner picked one. A failed upload must not
      //     lose the whole wizard, so the shop is still created without it.
      let banner_url;
      if (form.shopBannerUrl && !/^https?:/i.test(form.shopBannerUrl)) {
        try {
          const uploaded = await api.platform.uploadImage({ uri: form.shopBannerUrl });
          banner_url = uploaded?.url;
        } catch (e) {
          banner_url = undefined;
        }
      } else if (form.shopBannerUrl) {
        banner_url = form.shopBannerUrl;
      }

      // 3 · Step 2 — create the shop. `category_ids` must be public ids from
      //     the shop-category master; names are not accepted.
      const categoryIds = resolveCategoryIds(form.shopCategory);

      const shopFields = {
        name: form.shopName,
        category_ids: categoryIds,
        contact_phone: form.shopPhone,
        address_line: form.shopAddress,
        lat: form.shopLatitude,
        lng: form.shopLongitude,
        banner_url,
        avg_prep_eta_mins: form.avgPrepEtaMins,
      };
      // A retry after a later step failed finds the shop already created, and
      // createShop answers 409 forever — the owner could never get past this
      // screen. Apply the form to the existing shop instead and carry on.
      let created;
      try {
        created = await api.shop.createShop(shopFields);
      } catch (e) {
        if (e?.code !== 'SHOP_ALREADY_EXISTS') throw e;
        created = await api.shop.updateShop(shopFields);
      }

      // 4 · Step 3 — delivery boundary. Radius is sent in METRES; a polygon
      //     ring is [[lng, lat], …] (note the order flip from the map's
      //     {latitude, longitude} points).
      if (form.deliveryBoundaryType === 'radius') {
        await api.shop.setDeliveryZone({
          method: 'radius',
          radius_m: Math.round((form.deliveryRadiusKm || 1) * 1000),
        });
      } else if (form.deliveryPolygon?.length >= 3) {
        await api.shop.setDeliveryZone({
          method: 'polygon',
          ring: form.deliveryPolygon.map((p) => [p.longitude, p.latitude]),
        });
      }

      // 5 · Step 4 — Verification Document Upload & Submit → pending_verification.
      const uploadDocIfLocal = async (uri) => {
        if (!uri) return '';
        if (/^https?:/i.test(uri)) return uri;
        try {
          const res = await api.platform.uploadImage({ uri });
          return res?.url || uri;
        } catch (e) {
          console.error('[AuthContext] Document upload failed:', e);
          throw new Error('Failed to upload verification documents. Please try again.');
        }
      };

      const [aadhaar_url, pan_url, trade_license_url] = await Promise.all([
        uploadDocIfLocal(form.aadhaarUrl),
        uploadDocIfLocal(form.panUrl),
        uploadDocIfLocal(form.tradeLicenseUrl),
      ]);

      if (aadhaar_url && pan_url && trade_license_url) {
        await api.shop.submitDocuments({
          aadhaar_url,
          aadhaar_number: form.aadhaarNumber || undefined,
          pan_url,
          pan_number: form.panNumber || undefined,
          trade_license_url,
          trade_license_number: form.tradeLicenseNumber || undefined,
        });
      } else {
        await api.shop.submitShop();
      }

      const shopData = await ownerAuthService.getShop();
      setShop(shopData);
      setShopKnown(true);
      await saveShop(shopData);

      const profile = await api.auth.getOwnerProfile().catch(() => null);
      if (profile) {
        setOwner(profile);
        await saveOwner(profile);
      }

      // Flip the navigator last, so it lands on the waiting screen.
      setUserToken((current) => current || 'session');

      return created;
    },
    [],
  );

  const logout = useCallback(async () => {
    // Before the session is revoked: removing the device row is an
    // authenticated call.
    await unregisterFromPush();
    try {
      await api.auth.logout(refreshTokenRef.current);
    } catch (e) {
      // Clear the device regardless.
    } finally {
      await clearSession();
      refreshTokenRef.current = null;
      setUserToken(null);
      setOwner(null);
      setShop(null);
      setShopKnown(false);
      setNewOrdersCount(0);
      setUnreadCount(0);
      setNewSubscriptionsCount(0);
      setPendingKhataCount(0);
      setSubscription(null);
      // `appLanguage` and `languageChosen` are deliberately NOT reset — the
      // language belongs to the device, so signing out returns to Login rather
      // than to the language picker.
    }
  }, []);

  // After a confirmed deletion request. Local only: the server already ended
  // the session, and the push registration is deliberately left in place.
  const endSessionAfterDeletionRequest = useCallback(
    async (notice) => {
      deletionLockedRef.current = true;
      setAccountNotice(notice);
      await clearSession();
      refreshTokenRef.current = null;
      queryClient.clear();
      setUserToken(null);
      setOwner(null);
      setShop(null);
      setShopKnown(false);
      setNewOrdersCount(0);
      setUnreadCount(0);
      setNewSubscriptionsCount(0);
      setPendingKhataCount(0);
      setSubscription(null);
    },
    [queryClient],
  );

  // The website is about to take over deletion. If it locks the account, the
  // next call fails and the session is dropped — keep the push registration
  // through that, so "your account was resumed" can still reach this device.
  const markDeletionPending = useCallback(() => {
    deletionLockedRef.current = true;
  }, []);

  const clearAccountNotice = useCallback(() => {
    deletionLockedRef.current = false;
    setAccountNotice(null);
  }, []);

  const setAppLanguage = useCallback(
    async (lang) => {
      await AsyncStorage.setItem('owner_preferred_language', lang);
      setLanguageChosen(true);
      setAppLanguageState(lang);
      if (userToken) {
        api.auth.updateOwnerProfile({ language: lang }).catch(() => {});
      }
    },
    [userToken],
  );

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        userToken,
        owner,
        shop,
        shopRoute,
        shopKnown,
        isOffline,
        subscription,
        newOrdersCount,
        unreadCount,
        newSubscriptionsCount,
        markSubscriptionsSeen,
        pendingKhataCount,
        setPendingKhataCount,
        pendingChangeRequests,
        setPendingChangeRequests,
        login,
        logout,
        accountNotice,
        endSessionAfterDeletionRequest,
        markDeletionPending,
        clearAccountNotice,
        registerShop,
        refreshShop,
        updateShopState,
        updateOwnerState,
        refreshCounters,
        refreshSubscription,
        appLanguage,
        languageChosen,
        setAppLanguage,
        // Kept for call sites that still expect the old name.
        checkNewOrders: refreshCounters,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
