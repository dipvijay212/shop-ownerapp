import React, { useState, useEffect, useContext, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Modal,
  Platform,
  Dimensions,
  ActivityIndicator,
  Share,
  FlatList,
  SafeAreaView,
  Animated,
  Linking,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { useQRCodeActions } from '../hooks/useQRCodeActions';
import QRCodeView from '../components/QRCodeView';
import { API_ROOT_URL } from '../api/config';
import {
  Bell,
  User,
  TrendingUp,
  ShoppingBag,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Plus,
  QrCode,
  Users,
  Grid,
  Percent,
  MapPin,
  Map,
  ChevronRight,
  ClipboardList,
  Phone,
  BarChart2,
  BookOpen,
  MessageCircle,
  X,
  Share2,
  Download,
  Store,
  Sparkles,
  Smartphone,
  CalendarClock,
} from 'lucide-react-native';
import Svg, { Circle as SvgCircle, Polygon as SvgPolygon } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { AuthContext } from '../context/AuthContext';
import { api } from '../api';
import { adaptShopLedger } from '../api/adapters';
import { openWhatsApp } from '../utils/phone';
import { adaptNotification, adaptOrder, money } from '../api/adapters';
import Toast from 'react-native-toast-message';
import { CollapsibleOrderItems } from '../components/CollapsibleOrderItems';
import { useTranslation } from '../constants/translations';
import { isShopLive, scheduleStateNow } from '../utils/storeHours';
import { runNotificationAction } from '../services/pushService';

const { width } = Dimensions.get('window');

// The Home screen's "Recent Orders" preview. Off for now — the Orders tab is
// the place orders are worked from, and this duplicated it. Set to true to
// restore the section; nothing else has to change.
const SHOW_RECENT_ORDERS = false;


// Centre of the shop QR until the shop uploads its own logo.
const PAASORA_QR_LOGO = require('../assets/paasora-qr-logo.png');

export const DashboardScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { shop, refreshShop, checkNewOrders, refreshSubscription, unreadCount } = useContext(AuthContext);
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  // `status` is the approval state (draft | pending_verification | approved |
  // rejected | suspended) — 'active' is a mock-era value the API never sends,
  // so these both started false and the pill flashed Offline on every mount
  // before the data effect corrected it. `is_online` is the actual switch.
  const [shopOnline, setShopOnline] = useState(!!shop?.is_online);
  const slideAnim = useRef(new Animated.Value(isShopLive(shop) ? 1 : 0)).current;
  const [toggleBoxWidth, setToggleBoxWidth] = useState(width - 64);
  const isTogglingRef = useRef(false);

  // The schedule closes the shop on its own while this screen is sitting open,
  // so the banner has to notice the moment it happens rather than waiting for
  // the next unrelated render.
  const [minuteTick, setMinuteTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMinuteTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // `subscription_active` comes from GET /owner/shop and is the same predicate
  // customer discovery filters on, so it cannot drift from what shoppers see.
  // It is only absent on an older server, and there the server-side refusal on
  // the toggle still catches the case.
  const coverageLapsed = shop?.subscription_active === false;

  // Which of the two ran out. An owner who never bought a month has coverage
  // that ends exactly where the trial ends, so the two dates matching is the
  // whole test — and it decides whether to say "free trial ended" or "plan
  // expired", which are very different sentences to read on your own shop.
  const trialWasTheCoverage =
    !!shop?.coverage_ends_at
    && !!shop?.trial_ends_at
    && new Date(shop.coverage_ends_at).getTime() === new Date(shop.trial_ends_at).getTime();

  // What the banner reports. `shopOnline` is only the owner's manual switch —
  // the weekly schedule closes the shop independently, so a store with today
  // toggled off in Store Hours is invisible to customers no matter what the
  // toggle says. Reporting the toggle alone claimed "LIVE & accepting orders"
  // on a day nobody could order.
  const storeStatus = useMemo(() => {
    // Coverage outranks both the switch and the schedule: without it the shop
    // fails the very first clause of the customer-side visibility predicate.
    // Saying "Store is ONLINE" over a lapsed plan was the worst version of this
    // bug — the dashboard reported a shop that no shopper could find.
    if (coverageLapsed) {
      return {
        isLive: false,
        title: trialWasTheCoverage ? t('trialExpiredTitle') : t('planExpired'),
        subtitle: trialWasTheCoverage ? t('trialExpiredBannerSub') : t('planExpiredSub'),
      };
    }

    if (!shopOnline) {
      // Being offline is a manual choice, but it is easy to make it by accident
      // — a new shop starts offline. If today's schedule WOULD allow orders,
      // say so, otherwise the owner sees "OFFLINE" with no idea that the only
      // thing standing between them and customers is this switch.
      const scheduleAllowsToday = scheduleStateNow(shop?.hours).withinHours;
      return {
        isLive: false,
        title: t('storeOffline', 'Store is OFFLINE'),
        subtitle: scheduleAllowsToday
          ? 'Your hours allow orders today — switch Online to start accepting them.'
          : 'Store is OFFLINE. New orders are paused.',
      };
    }

    const { withinHours, reason } = scheduleStateNow(shop?.hours);
    if (withinHours) {
      return {
        isLive: true,
        title: t('storeOnline', 'Store is ONLINE'),
        subtitle: t('storeLiveSub'),
      };
    }

    return {
      isLive: false,
      title: t('closedBySchedule'),
      subtitle:
        reason === 'day_off'
          ? t('closedDayOffSub')
          : t('closedOutsideHoursSub'),
    };
    // `now` is read inside, so `minuteTick` is what re-runs this as the clock
    // crosses an opening or closing time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopOnline, shop?.hours, coverageLapsed, trialWasTheCoverage, t, minuteTick]);

  const isLive = storeStatus.isLive;

  // An expired plan or trial hides the shop no matter what the switch or the
  // schedule say, so it is the answer that has to come first. Asking about the
  // schedule before coverage is what put a "Closed by schedule" box in front of
  // owners whose real problem was an ended trial — sending them to edit hours
  // that were never wrong. The server refuses this too (SUBSCRIPTION_EXPIRED);
  // checking here as well is what stops the schedule short-circuit below from
  // answering before the server is ever asked.
  const promptToRenew = () => {
    Alert.alert(
      trialWasTheCoverage ? t('trialExpiredTitle') : t('planExpired'),
      trialWasTheCoverage ? t('trialExpiredGoOnlineBody') : t('planExpiredGoOnlineBody'),
      [
        { text: t('notNow'), style: 'cancel' },
        { text: t('seePlanCta'), onPress: () => navigation.navigate('SubscriptionPayment') },
      ],
    );
  };

  // Going online is refused by the server on a day the schedule has closed, and
  // the refusal is handled where the call is made. Tapping Online while already
  // online but schedule-closed still explains itself rather than doing nothing.
  const handleGoOnlinePressed = () => {
    if (coverageLapsed) {
      promptToRenew();
      return;
    }
    if (shopOnline && !isLive) {
      Alert.alert(
        t('closedBySchedule'),
        storeStatus.subtitle,
        [
          { text: t('notNow'), style: 'cancel' },
          { text: t('openStoreHours'), onPress: () => navigation.navigate('Profile', { initialMode: 'hours' }) },
        ],
      );
      return;
    }
    handleToggleShopStatus(true);
  };

  useEffect(() => {
    // Follows the effective state, not the raw toggle: a shop closed by its
    // weekly schedule is not taking orders, so the capsule must not sit on
    // "Online" directly beneath a banner saying it is closed.
    Animated.timing(slideAnim, {
      toValue: isLive ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isLive, slideAnim]);

  const capsuleWidth = Math.max(20, (toggleBoxWidth - 12) / 2);
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, capsuleWidth],
  });
  const greenOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const [orders, setOrders] = useState([]);
  const [showQrModal, setShowQrModal] = useState(false);

  const [backendQr, setBackendQr] = useState(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledger, setLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationCategory, setNotificationCategory] = useState('all');

  const visibleNotifications =
    notificationCategory === 'all'
      ? notifications
      : notifications.filter((n) => n.category === notificationCategory);

  // The list is otherwise only read when the dashboard gains focus, so a push
  // that arrived while it was on screen would be missing from the centre.
  const openAlertCentre = () => {
    setShowNotificationsModal(true);
    api.notifications
      .listNotifications({ limit: 20 })
      .then((res) => setNotifications((res?.items || []).map(adaptNotification)))
      .catch(() => {});
  };

  // Tapping an alert: mark it read here and on the server, then do exactly
  // what tapping the same push would have done.
  const openNotification = (notif) => {
    setShowNotificationsModal(false);
    if (!notif.isRead) {
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)));
      api.notifications.markRead(notif.id).then(() => checkNewOrders?.()).catch(() => {});
    }
    runNotificationAction(notif.data, { refreshShop, refreshSubscription }).catch(() => {});
  };

  const [loadingQr, setLoadingQr] = useState(false);

  const fetchBackendQr = useCallback(async () => {
    setLoadingQr(true);
    try {
      const res = await api.shop.getShopQr();
      if (res) setBackendQr(res);
    } catch (e) {
      console.log('[DashboardScreen] getShopQr failed:', e);
    } finally {
      setLoadingQr(false);
    }
  }, []);

  useEffect(() => {
    if (showQrModal) {
      fetchBackendQr();
    }
  }, [showQrModal, fetchBackendQr]);

  // Read on open, and again each time — a khata figure that is one session
  // stale is worse than a spinner.
  const fetchLedger = useCallback(async () => {
    setLedgerLoading(true);
    try {
      const res = await api.khata.getShopLedger(20);
      setLedger(adaptShopLedger(res?.data ?? res));
    } catch (e) {
      setLedger(null);
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showLedgerModal) fetchLedger();
  }, [showLedgerModal, fetchLedger]);

  const qrCardViewShotRef = useRef(null);
  const { isSharing, isDownloading, handleShare, handleDownload } = useQRCodeActions(qrCardViewShotRef, shop);
  
  // null = yesterday had no sales, so no comparison is meaningful.
  const [salesTrendPct, setSalesTrendPct] = useState(null);

  // Quick Metric states
  const [metrics, setMetrics] = useState({
    revenue: 0,
    totalOrders: 0,
    pending: 0,
    preparing: 0,
    ready: 0,
    delivered: 0,
    cancelled: 0,
  });

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Shop state comes from GET /owner/shop via AuthContext — never from the
      // mock store. getMockShop() returns status 'active', which is not one of
      // the API's statuses (draft | pending_verification | rejected | approved
      // | suspended), so feeding it to updateShopState() made routeForShop()
      // fall through to its default and bounce approved owners from the
      // dashboard straight into the onboarding wizard.
      if (!isTogglingRef.current) {
        setShopOnline(!!shop?.is_online);
      }

      // GET /owner/dashboard is purpose-built for this screen: server-computed
      // takings and counters, so the numbers match the admin panel instead of
      // being re-derived from whatever page of orders the client happened to
      // fetch. Notifications are independent, so one failing must not blank the
      // other.
      const [dashRes, ordersRes, notifRes] = await Promise.allSettled([
        api.business.getDashboard(),
        api.orders.listOrders({ limit: 10 }),
        api.notifications.listNotifications({ limit: 20 }),
      ]);

      if (dashRes.status === 'fulfilled') {
        const d = dashRes.value || {};
        const counters = d.counters || {};
        // null when yesterday had no sales — there is no percentage to show.
        setSalesTrendPct(
          d.pct_vs_yesterday === null || d.pct_vs_yesterday === undefined
            ? null
            : money(d.pct_vs_yesterday, null),
        );
        setMetrics({
          revenue: money(d.today_sales),
          totalOrders: (counters.new || 0) + (counters.processing || 0) + (counters.completed_today || 0),
          pending: counters.new || 0,
          preparing: counters.processing || 0,
          ready: 0,
          delivered: counters.completed_today || 0,
          cancelled: 0,
        });
      }

      if (ordersRes.status === 'fulfilled') {
        const rows = (ordersRes.value?.items || []).map(adaptOrder);
        // The list endpoint omits line items; the cards show them, so pull
        // detail for just the handful actually rendered.
        const detailed = await Promise.all(
          rows.slice(0, 5).map((row) =>
            api.orders
              .getOrder(row.id)
              .then((full) => adaptOrder(full))
              .catch(() => row),
          ),
        );
        setOrders(detailed);
      }

      if (notifRes.status === 'fulfilled') {
        setNotifications((notifRes.value?.items || []).map(adaptNotification));
      }
    } catch (e) {
      console.error(e);
      Toast.show({
        type: 'error',
        text1: t('loadErrorTitle'),
        text2: t('dashboardSyncFailed'),
      });
    } finally {
      setLoading(false);
    }
  }, [shop?.is_online, t]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData().catch((e) => console.error('[Dashboard] load rejected', e));
    }, [loadDashboardData])
  );

  const handleToggleShopStatus = (targetOnline) => {
    if (isTogglingRef.current) return;
    const nextState = targetOnline !== undefined ? targetOnline : !shopOnline;
    if (nextState === shopOnline) return;

    isTogglingRef.current = true;
    // Instantly update UI state so GPU animation triggers with zero lag
    setShopOnline(nextState);

    // Defer the network call so the UI thread doesn't hang during the animation
    setTimeout(async () => {
      try {
        // PUT /owner/shop/online, then re-read the shop so context holds a real
        // server object. The old path wrote a mock shop into shared state and
        // broke navigation for the whole app.
        await api.shop.setOnline(nextState);
        await refreshShop();
      } catch (e) {
        // The server refuses when the shop is not approved, the plan lapsed, or
        // today is closed in the store hours — put the switch back so it never
        // lies about the real state.
        setShopOnline(!nextState);

        if (e?.code === 'SHOP_HAS_NO_PRODUCTS') {
          // Same idea as the closed-day case: only one screen can fix this, so
          // offer it rather than leaving the owner to find it.
          Alert.alert(
            t('noProductsTitle', 'Nothing to sell yet'),
            e.message || t('nothingToSellBody'),
            [
              { text: t('notNow', 'Not now'), style: 'cancel' },
              { text: t('addProductCta', 'Add a product'), onPress: () => navigation.navigate('Products') },
            ],
          );
          return;
        }

        if (e?.code === 'SHOP_CLOSED_TODAY') {
          // The schedule is the only thing that can open a day, so send the
          // owner to the screen that can actually change it.
          Alert.alert(
            t('todayClosedTitle'),
            e.message || t('todayClosedBody'),
            [
              { text: t('notNow'), style: 'cancel' },
              { text: t('openStoreHours'), onPress: () => navigation.navigate('Profile', { initialMode: 'hours' }) },
            ],
          );
          return;
        }

        if (e?.code === 'SUBSCRIPTION_EXPIRED') {
          // Money is the only thing that fixes this, so the alert goes straight
          // to the plan rather than to a generic error toast.
          promptToRenew();
          return;
        }

        if (e?.code === 'SHOP_NOT_APPROVED') {
          Alert.alert(
            t('verificationRequiredTitle'),
            e.message || t('verificationRequiredBody'),
            [{ text: t('okBtn'), style: 'cancel' }],
          );
          return;
        }

        // Only genuinely unexpected failures reach the console. The refusals
        // above are answers, not faults — logging them as errors raised the
        // red dev overlay over an outcome the owner was already being shown
        // properly in an alert.
        console.warn('[Dashboard] online toggle failed', e?.code ?? '', e?.message ?? e);
        Toast.show({
          type: 'error',
          text1: t('couldNotChangeStatus'),
          text2: e.message || t('pleaseTryAgain'),
        });
      } finally {
        setTimeout(() => {
          isTogglingRef.current = false;
        }, 200);
      }
    }, 80);
  };

  // The mock took a free-form status string; the API models the lifecycle as
  // discrete transitions, each with its own endpoint and its own server-side
  // rules about which state it is legal from.
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      switch (newStatus) {
        case 'preparing':
          await api.orders.accept(orderId);
          break;
        case 'ready':
          await api.orders.markReady(orderId);
          break;
        case 'out_for_delivery':
          await api.orders.outForDelivery(orderId);
          break;
        case 'cancelled':
          // The API requires a reason and shows it to the customer.
          // The API status is `declined`; the word shown to people is "cancelled".
          await api.orders.decline(orderId, 'Cancelled by shop');
          break;
        default:
          return;
      }
      await loadDashboardData();
      if (checkNewOrders) checkNewOrders();
    } catch (e) {
      console.error('[Dashboard] order transition failed', e);
      Toast.show({
        type: 'error',
        text1: t('couldNotUpdateOrder'),
        text2: e.message || 'Please try again.',
      });
      // Re-read so the card stops offering a transition the order has already
      // moved past (stale list, second device, admin action).
      await loadDashboardData().catch(() => {});
    }
  };

  const handleCall = (num) => {
    Linking.openURL(`tel:${num}`).catch(() => {
      Toast.show({
        type: 'error',
        text1: t('errorTitle'),
        text2: t('callNotSupported'),
      });
    });
  };

  const handleWhatsApp = (num, name) => {
    const msg = `Hello ${name}, this is ${shop?.name || 'our store'} regarding your order.`;
    openWhatsApp(num, msg, () =>
      Toast.show({ type: 'error', text1: t('badPhone', 'That number cannot be opened in WhatsApp') }),
    );
  };

  const recentOrders = orders.filter(o => o.status === 'placed' || o.status === 'accepted' || o.status === 'preparing').slice(0, 3);

  const quickActions = [
    { id: 'orders', title: t('tabOrders', 'Manage Orders'), icon: ClipboardList, color: '#16A34A', bg: '#DCFCE7', onPress: () => navigation.navigate('Orders') },
    { id: 'add_product', title: t('addProduct', 'Add Product'), icon: Plus, color: '#15803D', bg: '#DCFCE7', onPress: () => navigation.navigate('Products') },
    { id: 'qr', title: t('storeQRCode', 'QR Code'), icon: QrCode, color: '#0F172A', bg: '#F1F5F9', onPress: () => setShowQrModal(true) },
    { id: 'ledger', title: t('tabKhata', 'Khata'), icon: BookOpen, color: '#D97706', bg: '#FEF3C7', onPress: () => setShowLedgerModal(true) },
    { id: 'delivery', title: t('deliveryGeofence', 'Delivery Area'), icon: Map, color: '#0D9488', bg: '#CCFBF1', onPress: () => navigation.navigate('DeliveryArea') },
    { id: 'timing', title: t('storeOperations', 'Shop timing'), icon: Clock, color: '#EA580C', bg: '#FFEDD5', onPress: () => navigation.navigate('Profile', { initialMode: 'hours' }) },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 6, height: 72 + insets.top }]}>
        <View style={styles.headerProfile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{shop?.name ? shop.name.charAt(0) : 'S'}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.shopName} numberOfLines={1}>{shop?.name || 'Your Shop'}</Text>
            <Text style={styles.ownerName}>{shop?.ownerName || 'Partner Portal'}</Text>
          </View>
        </View>
        <View style={styles.headerControls}>
          <TouchableOpacity style={styles.bellBtn} onPress={openAlertCentre}>
            <Bell color={theme.colors.textDark} size={22} />
            {/* The server's unread count, not the length of the list: that is
                capped at the 20 loaded, so the badge sat on 20 forever. */}
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Prominent Store Status Banner & Custom Animated Toggle */}
        <View style={[
          styles.statusBannerCard,
          {
            backgroundColor: storeStatus.isLive ? '#F0FDF4' : '#F8FAFC',
            borderColor: storeStatus.isLive ? '#BBF7D0' : '#E2E8F0',
          }
        ]}>
          <View style={styles.statusBannerTopRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <View style={[styles.statusIndicatorDot, { backgroundColor: storeStatus.isLive ? '#22C55E' : '#64748B' }]} />
                <Text style={[styles.statusBannerTitle, { color: shopOnline ? '#14532D' : '#1E293B' }]}>
                  {storeStatus.title}
                </Text>
              </View>
              <Text style={[styles.statusBannerSubtitle, { color: shopOnline ? '#15803D' : '#64748B' }]}>
                {storeStatus.subtitle}
              </Text>
            </View>
            <View style={[styles.syncBadge, { backgroundColor: shopOnline ? '#DCFCE7' : '#F1F5F9' }]}>
              <Clock size={12} color={shopOnline ? '#15803D' : '#64748B'} style={{ marginRight: 4 }} />
              <Text style={[styles.syncBadgeText, { color: shopOnline ? '#15803D' : '#64748B' }]}>
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>

          {/* Huge Animated Pill Switcher Track */}
          <View
            style={[
              styles.animatedToggleContainer,
              { backgroundColor: isLive ? '#16A34A' : '#475569', overflow: 'hidden' }
            ]}
            onLayout={(e) => setToggleBoxWidth(e.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                styles.animatedToggleCapsule,
                { width: capsuleWidth, transform: [{ translateX }] }
              ]}
            />

            {/* Offline Option */}
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.animatedToggleTab}
              onPress={() => {
                handleToggleShopStatus(false);
              }}
            >
              <Text style={[
                styles.animatedToggleText,
                { color: !isLive ? '#334155' : 'rgba(255, 255, 255, 0.85)' }
              ]}>
                {t('offlineLabel')}
              </Text>
            </TouchableOpacity>

            {/* Online Option */}
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.animatedToggleTab}
              onPress={handleGoOnlinePressed}
            >
              <Text style={[
                styles.animatedToggleText,
                { color: isLive ? '#15803D' : 'rgba(255, 255, 255, 0.85)' }
              ]}>
                {t('onlineLabel')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Analytics Section */}
        <Text style={styles.sectionTitle}>{t('todaySales', "Today's Sales")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsContainer}>
          <View style={[styles.metricCard, { borderColor: theme.colors.primary }]}>
            <TrendingUp color={theme.colors.primary} size={24} />
            <Text style={styles.metricValue}>₹{metrics.revenue.toFixed(0)}</Text>
            <Text style={styles.metricLabel}>{t('todaySales', "Today's Sales")}</Text>
            <Text style={styles.metricSubText}>
              {salesTrendPct === null
                ? t('noComparisonYesterday', 'No sales yesterday')
                : `${salesTrendPct >= 0 ? '+' : ''}${salesTrendPct.toFixed(1)}% vs yesterday`}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <ShoppingBag color="#3B82F6" size={24} />
            <Text style={styles.metricValue}>{metrics.totalOrders}</Text>
            <Text style={styles.metricLabel}>{t('totalOrders', 'Total Orders')}</Text>
            <Text style={styles.metricSubText}>{t('allStatusesToday')}</Text>
          </View>

          <View style={[styles.metricCard, metrics.pending > 0 && { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' }]}>
            <Clock color="#F59E0B" size={24} />
            <Text style={styles.metricValue}>{metrics.pending}</Text>
            <Text style={styles.metricLabel}>{t('placedOrders', 'Pending Orders')}</Text>
            <Text style={styles.metricSubText}>{t('needsAcceptReject')}</Text>
          </View>

          <View style={styles.metricCard}>
            <Truck color="#8B5CF6" size={24} />
            <Text style={styles.metricValue}>{metrics.preparing}</Text>
            <Text style={styles.metricLabel}>{t('processingOrders', 'Processing / Packing')}</Text>
            <Text style={styles.metricSubText}>{t('preparingOrdersLabel')}</Text>
          </View>

          <View style={styles.metricCard}>
            <CheckCircle color="#10B981" size={24} />
            <Text style={styles.metricValue}>{metrics.delivered}</Text>
            <Text style={styles.metricLabel}>{t('completedOrders', 'Delivered')}</Text>
            <Text style={styles.metricSubText}>{t('successHandovers')}</Text>
          </View>
        </ScrollView>

        {/* Quick Actions Grid */}
        <Text style={styles.sectionTitle}>{t('quickActions', 'Quick Operations')}</Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <TouchableOpacity key={action.id} style={styles.quickActionCard} onPress={action.onPress}>
                <View style={[styles.quickActionIconBg, { backgroundColor: action.bg }]}>
                  <Icon color={action.color} size={24} />
                </View>
                <Text style={styles.quickActionTitle}>{action.title}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Active/Recent orders preview — hidden for now. Flip
            SHOW_RECENT_ORDERS at the top of this file to bring it back. */}
        {SHOW_RECENT_ORDERS ? (
        <>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('recentOrders', 'Recent Orders')} ({recentOrders.length})</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
            <Text style={styles.viewAllLink}>{t('viewAll', 'View All')}</Text>
          </TouchableOpacity>
        </View>

        {recentOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <ShoppingBag size={48} color={theme.colors.border} />
            <Text style={styles.emptyStateTitle}>{t('allOrdersCleared')}</Text>
            <Text style={styles.emptyStateSub}>{t('allOrdersClearedSub')}</Text>
          </View>
        ) : (
          recentOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderCardHeader}>
                <View style={styles.orderMetadata}>
                  <Text style={styles.orderIdText}>#{order.orderNumber || order.id}</Text>
                  <Text style={styles.orderTimeText}>
                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  order.status === 'placed' ? styles.statusPlaced : styles.statusAccepted
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    order.status === 'placed' ? styles.statusPlacedText : styles.statusAcceptedText
                  ]}>
                    {order.status === 'placed' ? 'New Placed' : (order.status === 'preparing' || order.status === 'accepted' ? 'Preparing' : (order.status === 'out_for_delivery' ? 'Out for Delivery' : 'Delivered'))}
                  </Text>
                </View>
              </View>

              <View style={styles.orderCustomerRow}>
                <View style={styles.customerAvatar}>
                  <Text style={styles.customerAvatarText}>
                    {order.customer_name ? order.customer_name.charAt(0) : 'C'}
                  </Text>
                </View>
                <View style={styles.customerDetails}>
                  <Text style={styles.customerName}>{order.customer_name}</Text>
                  <Text style={styles.customerPhone}>{order.customer_phone}</Text>
                </View>
                <View style={styles.customerContactActions}>
                  <TouchableOpacity style={styles.contactBtn} onPress={() => handleCall(order.customer_phone)}>
                    <Phone size={18} color={theme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.contactBtn} onPress={() => handleWhatsApp(order.customer_phone, order.customer_name)}>
                    <MessageCircle size={18} color="#22C55E" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.orderDetailsDivider} />
              
              <CollapsibleOrderItems items={order.items} />

              <View style={styles.orderCardFooter}>
                <View>
                  <Text style={styles.footerPriceLabel}>{t('totalAmountLabel')}</Text>
                  <Text style={styles.footerPrice}>₹{order.total.toFixed(2)}</Text>
                </View>

                <View style={styles.orderActionsRow}>
                  {order.status === 'placed' ? (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.rejectBtn]}
                        onPress={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                      >
                        <Text style={styles.rejectBtnText}>{t('cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.acceptBtn]}
                        onPress={() => handleUpdateOrderStatus(order.id, 'preparing')}
                      >
                        <Text style={styles.acceptBtnText}>{t('acceptBtn')}</Text>
                      </TouchableOpacity>
                    </>
                  ) : (order.status === 'preparing' || order.status === 'accepted') ? (
                    /* preparing can only go to ready — see the lifecycle in
                       OrdersScreen. Offering "Out for Delivery" here skipped a
                       state and the server rejected it. */
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.readyBtn]}
                      onPress={() => handleUpdateOrderStatus(order.id, 'ready')}
                    >
                      <Text style={styles.readyBtnText}>{t('markReadyBtn')}</Text>
                    </TouchableOpacity>
                  ) : order.status === 'ready' ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.readyBtn]}
                      onPress={() => handleUpdateOrderStatus(order.id, 'out_for_delivery')}
                    >
                      <Text style={styles.readyBtnText}>{t('outForDeliveryBtn')}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.acceptBtn]}
                      onPress={() => navigation.navigate('Orders')}
                    >
                      <Text style={styles.acceptBtnText}>{t('manageOrderBtn')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
        </>
        ) : null}
      </ScrollView>

      {/* STORE QR CODE MODAL - MATCHES DESIGN IMAGE */}
      <Modal visible={showQrModal} transparent animationType="fade" onRequestClose={() => setShowQrModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.qrScrollModalView}
            contentContainerStyle={[
              styles.qrScrollModalContainer,
              { paddingBottom: Math.max(insets.bottom + 20, 24), paddingTop: Math.max(insets.top + 10, 16) }
            ]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.qrMainModalCard}>
              
              {/* Modal Top Header */}
              <View style={styles.fancyQrModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.fancyQrHeaderIconBg}>
                    <QrCode color="#16A34A" size={20} />
                  </View>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.fancyQrModalTitle}>{t('storeQrCode')}</Text>
                    <Text style={styles.fancyQrModalSub}>{t('scanToVisitShop')}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.fancyQrCloseBtn} onPress={() => setShowQrModal(false)}>
                  <X color="#64748B" size={18} />
                </TouchableOpacity>
              </View>

              {/* Main Standee Card Container wrapped in ViewShot */}
              <ViewShot
                ref={qrCardViewShotRef}
                options={{ format: 'png', quality: 1.0, result: 'tmpfile' }}
                style={{ borderRadius: 24, padding: 12, backgroundColor: '#FAFCFB' }}
                collapsable={false}
              >
                <View style={styles.fancyStandeeCard} collapsable={false}>
                  
                  {/* Dotted Grid Patterns in Top Corners */}
                  <View style={styles.dotGridTopLeft}>
                    <Svg width={40} height={40} viewBox="0 0 40 40">
                      {[0, 8, 16, 24, 32].map(x =>
                        [0, 8, 16, 24, 32].map(y => (
                          <SvgCircle key={`${x}-${y}`} cx={x + 4} cy={y + 4} r={1.2} fill="#CBD5E1" opacity={0.6} />
                        ))
                      )}
                    </Svg>
                  </View>

                  <View style={styles.dotGridTopRight}>
                    <Svg width={40} height={40} viewBox="0 0 40 40">
                      {[0, 8, 16, 24, 32].map(x =>
                        [0, 8, 16, 24, 32].map(y => (
                          <SvgCircle key={`${x}-${y}`} cx={x + 4} cy={y + 4} r={1.2} fill="#CBD5E1" opacity={0.6} />
                        ))
                      )}
                    </Svg>
                  </View>

                  {/* Decorative Floating Sparkles & Dots */}
                  <View style={[styles.floatingSparkle, { top: 38, left: 95 }]}>
                    <Sparkles size={10} color="#EAB308" />
                  </View>
                  <View style={[styles.floatingSparkle, { top: 65, right: 95 }]}>
                    <Sparkles size={10} color="#16A34A" />
                  </View>
                  <View style={[styles.floatingSparkle, { top: 125, left: 25 }]}>
                    <Sparkles size={12} color="#EAB308" />
                  </View>
                  <View style={[styles.floatingSparkle, { top: 125, right: 25 }]}>
                    <Sparkles size={12} color="#16A34A" />
                  </View>

                  {/* Top Store Header Badge */}
                  <View style={styles.standeeHeader}>
                    <View style={styles.storeAvatarOuterRing}>
                      <View style={styles.standeeStoreAvatar}>
                        <Store color="#FFF" size={24} />
                      </View>
                    </View>

                    <Text 
                      style={styles.standeeStoreName} 
                      numberOfLines={2} 
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.75}
                    >
                      {shop?.name || 'Your Shop'}
                    </Text>
                    
                    {/* Subtitle with divider lines */}
                    <View style={styles.storeSubtitleRow}>
                      <View style={styles.subtitleLine} />
                      <Text style={styles.storeSubtitleText}>
                        {t('favouriteStorePrefix')} <Text style={{ color: '#16A34A', fontWeight: '800' }}>{t('favouriteStoreWord')}</Text> {t('favouriteStoreSuffix')}
                      </Text>
                      <View style={styles.subtitleLine} />
                    </View>
                  </View>

                  {/* Central QR Code Container Box */}
                  <View style={styles.qrCodeSectionWrapper}>
                    {/* Top Attached Badge Pill */}
                    <View style={styles.scanBadgeContainer}>
                      <View style={styles.scanBadgePill}>
                        <Text style={styles.scanBadgeText}>{t('scanToVisitStoreCaps')}</Text>
                      </View>
                      <View style={styles.scanBadgeArrow} />
                    </View>

                    {/* Main QR Frame Box */}
                    <View style={styles.fancyQrBoxFrame}>
                      <View style={styles.fancyQrImageWrapper}>
                        <QRCodeView
                          value={
                            backendQr?.payload_url ||
                            (shop?.qr_code
                              ? `https://mjcp6mtf-4001.inc1.devtunnels.ms/s/${shop.qr_code}`
                              : 'https://mjcp6mtf-4001.inc1.devtunnels.ms/s/shop')
                          }
                          size={155}
                          color="#000000"
                          backgroundColor="#FFFFFF"
                        />

                        {/* Centered Brand Emblem Overlay — the shop's own logo
                            once it has uploaded one from Business Profile, so a
                            printed standee carries the shop's identity; the
                            Paasora mark until then. */}
                        <View style={styles.qrCenterLogoEmblem}>
                          <View style={styles.qrCenterLogoInner}>
                            <Image
                              source={shop?.logo_url ? { uri: shop.logo_url } : PAASORA_QR_LOGO}
                              style={styles.qrCenterLogoImage}
                              resizeMode="cover"
                            />
                          </View>
                        </View>
                      </View>

                      {/* Bottom Green Attached Bar */}
                      <View style={styles.qrBottomFeatureBar}>
                        <View style={styles.leftArrowTriangle} />
                        <Text style={styles.qrBottomFeatureText}>{t('openExploreShop')}</Text>
                        <View style={styles.rightArrowTriangle} />
                      </View>
                    </View>
                  </View>

                  {/* 3-Step Instruction Box */}
                  <View style={styles.stepsInstructionBox}>
                    <View style={styles.stepColumn}>
                      <View style={styles.stepIconBg}>
                        <Smartphone color="#16A34A" size={15} />
                      </View>
                      <Text style={styles.stepTitle}>{t('qrStepScan')}</Text>
                      <Text style={styles.stepSubtitle}>{t('qrStepScanSub')}</Text>
                    </View>

                    <View style={styles.stepDivider} />

                    <View style={styles.stepColumn}>
                      <View style={styles.stepIconBg}>
                        <Store color="#16A34A" size={15} />
                      </View>
                      <Text style={styles.stepTitle}>{t('qrStepVisit')}</Text>
                      <Text style={styles.stepSubtitle}>{t('qrStepVisitSub')}</Text>
                    </View>

                    <View style={styles.stepDivider} />

                    <View style={styles.stepColumn}>
                      <View style={styles.stepIconBg}>
                        <ShoppingBag color="#16A34A" size={15} />
                      </View>
                      <Text style={styles.stepTitle}>{t('qrStepShop')}</Text>
                      <Text style={styles.stepSubtitle}>{t('qrStepShopSub')}</Text>
                    </View>
                  </View>

                </View>
              </ViewShot>

              {/* Bottom Tip Container - OUTSIDE ViewShot so it's NOT in shared/downloaded image */}
              <View style={[styles.bottomTipPill, { marginTop: 14 }]}>
                <Text style={styles.bottomTipText}>
                  💡  Tip: Print this QR and place it at your store for easy access  💚
                </Text>
              </View>

              {/* Action Buttons Row - OUTSIDE ViewShot so buttons are NOT in captured image */}
              <View style={[styles.qrActionBar, { marginTop: 14 }]}>
                <TouchableOpacity
                  style={styles.fancyShareBtn}
                  activeOpacity={0.88}
                  onPress={handleShare}
                  disabled={isSharing}
                >
                  {isSharing ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Share2 color="#FFF" size={18} style={{ marginRight: 8 }} />
                      <Text style={styles.fancyShareBtnTitle}>{t('shareQr')}</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.fancyDownloadBtn}
                  activeOpacity={0.88}
                  onPress={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <ActivityIndicator color={theme.colors.primary} size="small" />
                  ) : (
                    <>
                      <Download color={theme.colors.primary} size={18} style={{ marginRight: 8 }} />
                      <Text style={styles.fancyDownloadBtnTitle}>{t('downloadBtn')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* CREDIT LEDGER MODAL */}
      {/* KHATA — the shop's real book. Every figure here used to be invented:
          ₹14,890 owed by five customers who do not exist. */}
      <Modal visible={showLedgerModal} transparent animationType="slide" onRequestClose={() => setShowLedgerModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowLedgerModal(false)} />
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom + 16, Platform.OS === 'ios' ? 34 : 28) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('creditLedger', 'Khata')}</Text>
              <TouchableOpacity onPress={() => setShowLedgerModal(false)}>
                <X color={theme.colors.textDark} size={24} />
              </TouchableOpacity>
            </View>

            {ledgerLoading && !ledger ? (
              <View style={{ paddingVertical: 40 }}>
                <ActivityIndicator color={theme.colors.primary} size="large" />
              </View>
            ) : (
              <ScrollView style={styles.ledgerScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
                {/* The headline figure, then the two facts that qualify it —
                    as labelled stats rather than three amber sentences. */}
                <View style={styles.ledgerSummaryBox}>
                  <Text style={styles.ledgerLabel}>{t('totalOutstanding')}</Text>
                  <Text style={styles.ledgerAmount}>₹{(ledger?.totalOutstanding ?? 0).toFixed(2)}</Text>

                  <View style={styles.ledgerDivider} />

                  <View style={styles.ledgerStatRow}>
                    <View style={styles.ledgerStat}>
                      <Text style={styles.ledgerStatValue}>
                        {t('owingValue', {
                          count: ledger?.customersWithDues ?? 0,
                          total: ledger?.customersTotal ?? 0,
                        })}
                      </Text>
                      <Text style={styles.ledgerStatLabel}>{t('owingLabel')}</Text>
                    </View>

                    {(ledger?.totalAdvance ?? 0) > 0 ? (
                      <>
                        <View style={styles.ledgerStatDivider} />
                        <View style={styles.ledgerStat}>
                          <Text style={styles.ledgerStatValue}>₹{ledger.totalAdvance.toFixed(2)}</Text>
                          <Text style={styles.ledgerStatLabel}>{t('heldInAdvance')}</Text>
                        </View>
                      </>
                    ) : null}
                  </View>
                </View>

                <Text style={styles.ledgerHeader}>{t('recentKhataActivity')}</Text>
                {(ledger?.items ?? []).length === 0 ? (
                  <Text style={styles.ledgerEmpty}>{t('noKhataActivity')}</Text>
                ) : (
                  (ledger?.items ?? []).map((item) => {
                    // Money IN reduces what the shop is owed; money OUT grows it.
                    const isIn = item.entryType === 'repayment' || item.entryType === 'advance_deposit';
                    const label =
                      item.entryType === 'repayment' ? t('entryRepayment')
                      : item.entryType === 'advance_deposit' ? t('entryAdvanceDeposit')
                      : item.entryType === 'advance_applied' ? t('entryAdvanceApplied')
                      : item.entryType === 'adjustment' ? t('entryAdjustment')
                      : t('entryUdhari');
                    return (
                      <View key={item.id} style={styles.ledgerRow}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={styles.ledgerCustomerName}>
                            {item.customerName}
                          </Text>
                          <Text style={[styles.ledgerDate, { color: '#475569', fontWeight: '700' }]}>
                            {label}
                            {item.orderNo ? ` · ${item.orderNo}` : ''}
                            {item.paymentMode ? ` (${item.paymentMode})` : ''}
                          </Text>
                          <Text style={styles.ledgerDate}>
                            {new Date(item.createdAt).toLocaleString('en-IN', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                            })}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[
                            styles.ledgerRowAmount,
                            { color: isIn ? theme.colors.success : theme.colors.error },
                          ]}>
                            {isIn ? '-' : '+'}₹{item.amount.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.shareQrBtn}
              onPress={() => { setShowLedgerModal(false); navigation.navigate('Customers'); }}
            >
              <Text style={styles.shareQrText}>{t('viewAllCustomers')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* COUPONS MODAL */}
      <Modal visible={showCouponModal} transparent animationType="slide" onRequestClose={() => setShowCouponModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowCouponModal(false)} />
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom + 16, Platform.OS === 'ios' ? 34 : 28) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('storeCouponsDiscounts')}</Text>
              <TouchableOpacity onPress={() => setShowCouponModal(false)}>
                <X color={theme.colors.textDark} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.ledgerScroll} contentContainerStyle={{ paddingBottom: 12 }}>
              {[
                { code: 'FRESH20', desc: '20% OFF on vegetables & fruits', active: true, usage: 'Used 42 times' },
                { code: 'WELCOME100', desc: 'Flat ₹100 discount on first purchase above ₹800', active: true, usage: 'Used 129 times' },
                { code: 'WEEKEND50', desc: 'Flat ₹50 off on weekends', active: false, usage: 'Expired' },
              ].map((coupon, idx) => (
                <View key={idx} style={[styles.couponCard, !coupon.active && { opacity: 0.6 }]}>
                  <View style={styles.couponHeader}>
                    <View style={styles.couponTag}>
                      <Text style={styles.couponCode}>{coupon.code}</Text>
                    </View>
                    <Switch value={coupon.active} onValueChange={() => {}} />
                  </View>
                  <Text style={styles.couponDesc}>{coupon.desc}</Text>
                  <Text style={styles.couponUsage}>{coupon.usage}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.shareQrBtn} onPress={() => Toast.show({ type: 'success', text1: t('couponCreated'), text2: t('couponCreatedSub') })}>
              <Text style={styles.shareQrText}>{t('createNewCoupon')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CATEGORIES MODAL */}
      <Modal visible={showCategoryModal} transparent animationType="slide" onRequestClose={() => setShowCategoryModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowCategoryModal(false)} />
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom + 16, Platform.OS === 'ios' ? 34 : 28) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('manageProductCategories')}</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <X color={theme.colors.textDark} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.ledgerScroll} contentContainerStyle={{ paddingBottom: 12 }}>
              {[
                { name: t('catVegetables'), count: t('productsCount', { count: 12 }), image: 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=100' },
                { name: t('catFruits'), count: t('productsCount', { count: 8 }), image: 'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?w=100' },
                { name: t('catDairy'), count: t('productsCount', { count: 15 }), image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=100' },
                { name: t('catStaples'), count: t('productsCount', { count: 24 }), image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=100' },
              ].map((cat, idx) => (
                <View key={idx} style={styles.categoryRow}>
                  <Image source={{ uri: cat.image }} style={styles.categoryImg} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.categoryNameText}>{cat.name}</Text>
                    <Text style={styles.categoryCountText}>{cat.count}</Text>
                  </View>
                  <TouchableOpacity style={styles.catEditBtn}>
                    <Text style={styles.catEditBtnText}>{t('editBtn')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.shareQrBtn} onPress={() => Toast.show({ type: 'info', text1: t('infoTitle'), text2: t('addProductSelectCategory') })}>
              <Text style={styles.shareQrText}>{t('createCustomCategory')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* NOTIFICATION CENTER & AI INSIGHTS MODAL */}
      <Modal visible={showNotificationsModal} transparent animationType="slide" onRequestClose={() => setShowNotificationsModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowNotificationsModal(false)} />
          <View style={[styles.modalContent, { maxHeight: '88%', height: '88%', paddingBottom: Math.max(insets.bottom + 16, Platform.OS === 'ios' ? 34 : 28) }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Bell color={theme.colors.textDark} size={22} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>{t('merchantAlertCenter')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowNotificationsModal(false)}>
                <X color={theme.colors.textDark} size={24} />
              </TouchableOpacity>
            </View>

            {/* Category Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.notifFilterScroll} contentContainerStyle={styles.notifFilterContainer}>
              {[
                { key: 'all', label: t('alertTabAll') },
                { key: 'orders', label: t('alertTabOrders') },
                { key: 'subscription', label: t('alertTabSubscription') },
                { key: 'khata', label: t('alertTabKhata') },
                // Plan renewals, payouts and verification decisions. They used
                // to sit under Subscription, which is the round, so an owner
                // filtering for deliveries got billing notices instead.
                { key: 'account', label: t('alertTabAccount') },
              ].map(tab => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.notifFilterPill, notificationCategory === tab.key && styles.notifFilterPillActive]}
                  onPress={() => setNotificationCategory(tab.key)}
                >
                  <Text style={[styles.notifFilterText, notificationCategory === tab.key && styles.notifFilterTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 6 }}>
              {visibleNotifications.length === 0 && (
                <View style={styles.notifEmpty}>
                  <Bell color="#94A3B8" size={40} />
                  <Text style={styles.notifEmptyTitle}>{t('alertCentreEmpty')}</Text>
                  <Text style={styles.notifEmptySub}>{t('alertCentreEmptySub')}</Text>
                </View>
              )}
              {visibleNotifications.map(notif => (
                  // The whole card opens what the alert is about, exactly as
                  // tapping the same push would. The adapter's fields are
                  // camelCase; this used to read `is_read`/`created_at`, so
                  // every card looked unread and every date said "Today".
                  <TouchableOpacity
                    key={notif.id}
                    style={[styles.notifCard, !notif.isRead && styles.notifCardUnread]}
                    activeOpacity={0.75}
                    onPress={() => openNotification(notif)}
                  >
                    <View style={styles.notifHeaderRow}>
                      <Text style={[styles.notifTitle, { color: theme.colors.textDark }]}>
                        {notif.title}
                      </Text>
                      <Text style={styles.notifTime}>
                        {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                      </Text>
                    </View>
                    <Text style={styles.notifBody}>{notif.body}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  ledgerSummaryBox: {
    // A tinted card with a border rather than a flood of amber — the colour
    // marks the section, the type does the ranking.
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 18,
  },
  ledgerLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  ledgerAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#92400E',
    marginTop: 6,
    letterSpacing: -0.5,
  },
  ledgerDivider: {
    height: 1,
    backgroundColor: '#FDE68A',
    marginTop: 16,
    marginBottom: 14,
  },
  ledgerStatRow: { flexDirection: 'row', alignItems: 'center' },
  ledgerStat: { flex: 1 },
  ledgerStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#FDE68A',
    marginHorizontal: 14,
  },
  ledgerStatValue: { fontSize: 16, fontWeight: '800', color: '#78350F' },
  ledgerStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A16207',
    marginTop: 2,
  },
  ledgerHeader: { fontSize: 13, fontWeight: '800', color: theme.colors.textDark, marginBottom: 10 },
  ledgerEmpty: { fontSize: 13, color: theme.colors.textLight, paddingVertical: 14 },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  ledgerCustomerName: { fontSize: 14, fontWeight: '800', color: theme.colors.textDark },
  ledgerDate: { fontSize: 11.5, color: theme.colors.textLight, fontWeight: '600', marginTop: 1 },
  ledgerRowAmount: { fontSize: 15, fontWeight: '800' },
  qrCenterLogoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    height: 72,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.m,
  },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  shopName: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  ownerName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textLight,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  statusToggleContainer: {
    alignItems: 'center',
    marginRight: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },
  scrollContent: {
    padding: theme.spacing.m,
    paddingBottom: 40,
  },
  statusBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  statusBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBannerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    lineHeight: 18,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  syncBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  animatedToggleContainer: {
    height: 64,
    borderRadius: 32,
    flexDirection: 'row',
    padding: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  animatedToggleCapsule: {
    position: 'absolute',
    left: 6,
    top: 6,
    bottom: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  animatedToggleTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  animatedToggleText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  syncText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primaryDark,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 12,
  },
  metricsContainer: {
    paddingBottom: 16,
  },
  metricCard: {
    width: 140,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    padding: 14,
    marginRight: 12,
    ...theme.shadows.soft,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginTop: 10,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textLight,
    marginTop: 2,
  },
  metricSubText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 4,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quickActionCard: {
    width: '30%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    marginBottom: 12,
    ...theme.shadows.soft,
  },
  quickActionIconBg: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textDark,
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllLink: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  emptyState: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    ...theme.shadows.soft,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginTop: 10,
  },
  emptyStateSub: {
    fontSize: 13,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: 4,
  },
  orderCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.soft,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderIdText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  orderTimeText: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginLeft: 8,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusPlaced: {
    backgroundColor: '#FEF3C7',
  },
  statusPlacedText: {
    color: '#D97706',
  },
  statusAccepted: {
    backgroundColor: '#DBEAFE',
  },
  statusAcceptedText: {
    color: '#2563EB',
  },
  orderCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  customerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  customerPhone: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textLight,
    marginTop: 1,
  },
  customerContactActions: {
    flexDirection: 'row',
  },
  contactBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  orderDetailsDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 8,
  },
  itemsSummary: {
    fontSize: 14,
    color: theme.colors.textDark,
    fontWeight: '700',
    marginBottom: 12,
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerPriceLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  footerPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  orderActionsRow: {
    flexDirection: 'row',
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  rejectBtn: {
    backgroundColor: '#FEE2E2',
  },
  rejectBtnText: {
    color: theme.colors.error,
    fontSize: 13,
    fontWeight: '800',
  },
  acceptBtn: {
    backgroundColor: theme.colors.primary,
  },
  acceptBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  readyBtn: {
    backgroundColor: '#D1FAE5',
  },
  readyBtnText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '800',
  },
  // Modal Overlays
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  qrScrollModalView: {
    flex: 1,
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.spacing.m,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  qrScrollModalContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
    width: '100%',
  },
  qrMainModalCard: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 10,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  fancyQrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  fancyQrHeaderIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fancyQrModalTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  fancyQrModalSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  fancyQrCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fancyStandeeCard: {
    backgroundColor: '#FAFCFB',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 12,
    width: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  dotGridTopLeft: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  dotGridTopRight: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  floatingSparkle: {
    position: 'absolute',
    zIndex: 2,
  },

  standeeHeader: {
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
    paddingHorizontal: 24,
    zIndex: 3,
  },
  storeAvatarOuterRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    backgroundColor: '#F0FDF4',
  },
  standeeStoreAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  standeeStoreName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginTop: 2,
    marginBottom: 2,
  },
  storeSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
  },
  subtitleLine: {
    height: 1,
    width: 24,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 6,
  },
  storeSubtitleText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '500',
  },
  qrCodeSectionWrapper: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 8,
    zIndex: 3,
  },
  scanBadgeContainer: {
    alignItems: 'center',
    zIndex: 10,
    marginBottom: -10,
  },
  scanBadgePill: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: 18,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.6,
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 14,
  },
  scanBadgeArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#16A34A',
    marginTop: -1,
  },
  fancyQrBoxFrame: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#16A34A',
    overflow: 'hidden',
    alignItems: 'center',
    width: 206,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  fancyQrImageWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  fancyQrImage: {
    width: 155,
    height: 155,
  },
  qrCenterLogoEmblem: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 4,
  },
  qrCenterLogoInner: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.2,
    borderColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrBottomFeatureBar: {
    width: '100%',
    backgroundColor: '#16A34A',
    paddingVertical: 7,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrBottomFeatureText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  leftArrowTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 4.5,
    borderBottomWidth: 4.5,
    borderLeftWidth: 7,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
    marginRight: 6,
  },
  rightArrowTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 4.5,
    borderBottomWidth: 4.5,
    borderRightWidth: 7,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#FFFFFF',
    marginLeft: 6,
  },
  stepsInstructionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 8,
    marginTop: 12,
    marginBottom: 4,
    width: '100%',
  },
  stepColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  stepIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 2,
    includeFontPadding: false,
  },
  stepSubtitle: {
    fontSize: 9.5,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 13,
    includeFontPadding: false,
  },
  stepDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#F1F5F9',
  },
  qrActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
    gap: 6,
  },
  fancyShareBtn: {
    flex: 1,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 16,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  fancyShareBtnTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  fancyDownloadBtn: {
    flex: 1,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAF9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
  },
  fancyDownloadBtnTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#16A34A',
  },
  bottomTipPill: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  bottomTipText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#15803D',
    textAlign: 'center',
    lineHeight: 11,
  },
  ledgerScroll: {
    marginBottom: 12,
  },
  couponCard: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  couponHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  couponTag: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C084FC',
  },
  couponCode: {
    color: '#9333EA',
    fontWeight: '800',
    fontSize: 12,
  },
  couponDesc: {
    fontSize: 14,
    color: theme.colors.textDark,
    fontWeight: '700',
    marginTop: 8,
  },
  couponUsage: {
    fontSize: 11,
    color: theme.colors.textLight,
    fontWeight: '800',
    marginTop: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  categoryImg: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#ECEFF1',
  },
  categoryNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  categoryCountText: {
    fontSize: 12,
    color: theme.colors.textLight,
    fontWeight: '700',
    marginTop: 2,
  },
  catEditBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  catEditBtnText: {
    color: theme.colors.textDark,
    fontSize: 12,
    fontWeight: '800',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  notifFilterScroll: {
    maxHeight: 46,
    marginBottom: 8,
  },
  notifFilterContainer: {
    paddingVertical: 4,
  },
  notifFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notifFilterPillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  notifFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  notifFilterTextActive: {
    color: '#FFF',
    fontWeight: '850',
  },
  notifCard: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    ...theme.shadows.small,
  },
  notifCardUnread: {
    backgroundColor: '#FAFAFC',
    borderColor: '#CBD5E1',
  },
  notifEmpty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  notifEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textDark,
    marginTop: 12,
  },
  notifEmptySub: {
    fontSize: 13,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  notifTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '850',
    marginRight: 8,
    lineHeight: 20,
  },
  notifTime: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  notifBody: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 12,
  },
  notifActionBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  notifActionText: {
    fontSize: 12,
    fontWeight: '850',
  },
});
