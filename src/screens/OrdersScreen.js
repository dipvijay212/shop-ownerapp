import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Linking,
  Platform,
  RefreshControl,
  DeviceEventEmitter,
} from 'react-native';
import {
  Search,
  Phone,
  MessageCircle,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  MapPin,
  ChevronRight,
  Filter,
  User,
  ShoppingBag,
  FileText,
  Check,
  Calendar,
  ChevronDown,
} from 'lucide-react-native';
import { api } from '../api';
import { openWhatsApp } from '../utils/phone';
import { adaptOrder } from '../api/adapters';
import { getErrorText } from '../api/errors';
import { AuthContext } from '../context/AuthContext';
import { theme } from '../theme';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CollapsibleOrderItems } from '../components/CollapsibleOrderItems';
import { useTranslation } from '../constants/translations';
import { PaymentSettlementModal } from '../components/PaymentSettlementModal';
import DateRangeSheet from '../components/DateRangeSheet';
import OrderDetailSheet from '../components/OrderDetailSheet';
import ConfirmSheet from '../components/ConfirmSheet';
import { PUSH_RECEIVED } from '../services/pushService';

const settlementTitle = (mode) =>
  mode === 'partial' ? 'Part paid, part on khata'
  : mode === 'full_khata' ? 'Fully on khata'
  : 'Paid in full';

// The IST calendar day of an instant — the same day the shop is standing in.
const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const pretty = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};

export const OrdersScreen = () => {
  const insets = useSafeAreaInsets();
  const { checkNewOrders, shop, setNewOrdersCount } = useContext(AuthContext);
  const { t } = useTranslation();

  const ORDER_FILTERS = [
    { label: t('allOrders', 'All'), value: 'all' },
    { label: t('placedOrders', 'New Placed'), value: 'placed' },
    { label: t('preparingOrders', 'Preparing'), value: 'preparing' },
    { label: t('outForDeliveryOrders', 'Out for Delivery'), value: 'out_for_delivery' },
    { label: t('completedOrders', 'Delivered'), value: 'delivered' },
    { label: t('cancelledOrders', 'Cancelled'), value: 'cancelled' },
    // A real terminal status (the slot passed unconfirmed) that had no chip at
    // all, so those orders showed only under "All".
    { label: t('notDeliveredOrders', 'Not delivered'), value: 'not_delivered' },
  ];


  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  // Pull-to-refresh, and the id of the order whose status is being changed
  // right now — the card shows a spinner on that button and blocks a second tap.
  const [refreshing, setRefreshing] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  // The Orders tab is the shop's working list: what is still owed to someone.
  // It opened on today's orders, which hid an order placed on Tuesday that
  // nobody had accepted yet — the badge said 15 while the screen said none.
  // `range === null` means "everything unfinished, any day"; choosing dates
  // switches to that window and shows every status inside it.
  const [range, setRange] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // fetchOrders is memoised on [] and reads the current range through a ref,
  // the same way it already reads pendingMode.
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const pendingMode = range === null;
  const rangeLabel = pendingMode
    ? t('pendingOrders', 'Pending')
    : range.from === range.to
      ? pretty(range.from)
      : `${pretty(range.from)} – ${pretty(range.to)}`;
  const [activePicker, setActivePicker] = useState(null); // 'start' | 'end' | null
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [settlementTargetOrder, setSettlementTargetOrder] = useState(null);

  // `silent` keeps the list on screen while it refreshes. Only the very first
  // load should blank the screen — a background re-read must not.
  const fetchOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      // The list endpoint omits line items, which every card renders, so each
      // row is expanded via its detail endpoint. Failures fall back to the
      // summary rather than dropping the order from the list entirely.
      // Ask the server for the right SET, not just the newest rows. Fetching
      // the last 30 and filtering here would have dropped an unaccepted order
      // from 19 Aug straight off the end of the window.
      // A date range filters in the database now, so the 60-row cap can no
      // longer hide an older order that falls inside the window. With no range
      // the screen shows the working list: everything unfinished, plus what was
      // settled today — a delivered order should stay visible until the day is
      // over rather than vanishing the moment it is marked.
      const r = rangeRef.current;
      const page = await api.orders.listOrders(
        r ? { limit: 100, from: r.from, to: r.to } : { status: 'working', limit: 100 },
      );
      const rows = (page?.items || []).map(adaptOrder);
      const detailed = await Promise.all(
        rows.map((row) =>
          api.orders
            .getOrder(row.id)
            .then((full) => adaptOrder(full))
            .catch(() => row),
        ),
      );
      setOrders(detailed);

      const normalPlaced = detailed.filter(
        (o) => !o.isSubscription && !o.is_subscription && !o.standing_order_id && o.type !== 'subscription' && o.status === 'placed',
      );
      setNewOrdersCount?.(normalPlaced.length);
    } catch (e) {
      console.error('[OrdersScreen] Error fetching orders:', e);
      Toast.show({
        type: 'error',
        text1: t('fetchErrorTitle'),
        text2: t('couldNotLoadOrders'),
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [setNewOrdersCount, t]);

  // Re-read ONE order and swap it in place. Changing a status used to call
  // fetchOrders(), which blanked the whole screen behind a spinner, re-fetched
  // the detail of every row (about thirty requests for a one-row change) and
  // threw away the scroll position. The card the owner just acted on is the
  // only thing that changed.
  const refreshOrder = useCallback(async (orderId) => {
    try {
      const full = adaptOrder(await api.orders.getOrder(orderId));
      setOrders((prev) => {
        const filtered = prev.filter((o) => o.id !== orderId);
        return [full, ...filtered];
      });
      return full;
    } catch (e) {
      console.error('[Orders] could not refresh order', orderId, e);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // A new order used to appear only after restarting the app: this screen read
  // the list once on mount and never again. AuthContext polls the COUNTERS
  // every 30s, which is why the tab badge moved while the list did not.
  //
  // Re-read whenever the screen is focused, and keep polling quietly while it
  // stays open so an order arriving mid-shift shows up on its own.
  useFocusEffect(
    useCallback(() => {
      fetchOrders({ silent: true });
      const timer = setInterval(() => fetchOrders({ silent: true }), 30000);
      return () => clearInterval(timer);
    }, [fetchOrders]),
  );

  // Switching between the working list and a date window changes which rows
  // the server should send, so it is a refetch, not a client-side filter.
  useEffect(() => {
    fetchOrders({ silent: true });
    // Keyed on the range ITSELF: the dates are now part of the request, so
    // changing 14 Aug–7 Sept to 1–5 Jul has to go back to the server. Keying on
    // `range === null` only noticed the switch between modes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to]);

  // A tapped notification lands here with the order to open. The param is
  // cleared at once, or coming back to this tab later would reopen the sheet.
  const navigation = useNavigation();
  const openOrderId = useRoute().params?.openOrderId;
  useEffect(() => {
    if (!openOrderId) return;
    navigation.setParams({ openOrderId: undefined });
    api.orders
      .getOrder(openOrderId)
      .then((full) => setSelectedOrder(adaptOrder(full)))
      .catch((e) => {
        // The tab itself is still the right place to have landed, so a missing
        // order only costs the sheet. Anything else is a real failure and is
        // still logged loudly.
        if (e?.isNotFound) {
          Toast.show({ type: 'info', text1: t('orderGone', 'That order is no longer available') });
          return;
        }
        console.error('[Orders] could not open order from notification', openOrderId, e);
      });
  }, [openOrderId, navigation, t]);

  // A push arriving while the app is open: re-read the list now rather than
  // on the next 30-second poll, so a new order is on screen with its banner.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(PUSH_RECEIVED, (data) => {
      if (data?.type?.startsWith('order_') || data?.type === 'khata_charge') {
        fetchOrders({ silent: true });
      }
    });
    return () => sub.remove();
  }, [fetchOrders]);

  const onPullToRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders({ silent: true });
    setRefreshing(false);
  }, [fetchOrders]);

  const handleOpenSettlementModal = (order) => {
    setSettlementTargetOrder(order);
  };

  const handleConfirmSettlement = async (orderId, settlementData) => {
    try {
      const target =
        orders.find((o) => o.id === orderId) ||
        (selectedOrder?.id === orderId ? selectedOrder : null);

      // The modal offers Full payment or Khata; the API still models three
      // outcomes. Read them off the AMOUNTS rather than the chosen card, so
      // "Khata" with the full sum typed in settles as a full payment instead
      // of a khata entry for zero.
      // The modal offers Full payment or Khata; the API models three outcomes,
      // and only `partial` carries a cash_amount. Anything that has to tell
      // the server a NUMBER — a split, or change kept as advance — has to go
      // as partial, or the amount never leaves the phone.
      const settlementMode = (d) =>
        // Nothing handed over -> the whole order rides on the khata. This has
        // to come first: `partial` requires a cash_amount above zero, so
        // routing this case there would be rejected outright.
        d.paid_amount <= 0 ? 'full_khata'
        // A split, or change kept as advance, both have to tell the server a
        // NUMBER, and `partial` is the only mode that carries one.
        : d.khata_amount > 0 || d.extra_deposited > 0 ? 'partial'
        : 'full_payment';

      // The key has to be stable for THIS settlement, not fresh per call.
      // `newIdempotencyKey()` inline meant a second tap carried a new key, so
      // the server treated it as a new request and the state machine refused
      // 'delivered' -> 'delivered'. Keyed by order, a duplicate now replays the
      // first response instead. The server drops the key when a call fails, so
      // correcting an amount and retrying still works.
      const idemKey = `settle-${orderId}`;
      if (settlementData.type === 'prepaid' || (target?.paymentMethod && target.paymentMethod !== 'cod')) {
        await api.orders.deliverPrepaid(orderId, idemKey);
      } else {
        await api.orders.deliverCod(
          orderId,
          {
            mode: settlementMode(settlementData),
            cashAmount: settlementData.paid_amount,
          },
          idemKey,
        );
      }
      setSettlementTargetOrder(null);

      const paidStr = settlementData.paid_amount > 0 ? `Paid: ₹${settlementData.paid_amount.toFixed(2)}` : '';
      const khataStr = settlementData.khata_amount > 0 ? `Khata: ₹${settlementData.khata_amount.toFixed(2)}` : '';
      const detailsStr = [paidStr, khataStr].filter(Boolean).join(' | ');

      Toast.show({
        type: 'success',
        text1: t('orderDeliveredSettled'),
        text2: detailsStr ? `Settlement: ${detailsStr}` : 'Order marked as completed.',
      });
      await refreshOrder(orderId);
      if (checkNewOrders) checkNewOrders();
      
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => ({
          ...prev,
          status: 'delivered',
          // The modal speaks { type, paid_amount, khata_amount }; everything
          // that reads `settlement` speaks the adapter's { mode, cash, khata }.
          // Storing the modal's shape here showed ₹0.00 until the next refetch.
          settlement: {
            mode: settlementMode(settlementData),
            cash: settlementData.paid_amount,
            khata: settlementData.khata_amount,
          },
          payment_status: settlementData.khata_amount <= 0
            ? 'completed'
            : settlementData.paid_amount > 0 ? 'partial' : 'khata_pending',
        }));
      }
    } catch (e) {
      // Already delivered is not a failure — the settlement landed, this is a
      // duplicate submission. Showing a red error over a completed order sends
      // the shop looking for a problem that does not exist.
      if (e?.isInvalidTransition || e?.code === 'IDEMPOTENCY_IN_PROGRESS') {
        setSettlementTargetOrder(null);
        await refreshOrder(orderId);
        if (checkNewOrders) checkNewOrders();
        return;
      }
      console.error(e);
      Toast.show({
        type: 'error',
        text1: t('errorTitle'),
        // The real reason, not a blanket message — an over-limit khata and a
        // dead network need different responses from the shop.
        text2: getErrorText(e),
      });
      throw e;
    }
  };

  // An accepted order may already be paid for and out with a rider, so this
  // one asks first — unlike declining a brand-new order, it cannot be undone.
  const [cancelTarget, setCancelTarget] = useState(null);

  const handleUpdateStatus = async (orderId, newStatus) => {
    if (updatingOrderId) return;

    // Deliver opens the settlement sheet instead of calling anything, so it
    // must not claim the busy flag: it used to set `updatingOrderId` and then
    // return before the try/finally that clears it. The flag stuck, that
    // order's buttons span forever, and `if (updatingOrderId) return` then
    // swallowed every other action on the screen until a reload.
    if (newStatus === 'delivered') {
      const target = orders.find(o => o.id === orderId) || (selectedOrder?.id === orderId ? selectedOrder : null);
      if (target) {
        handleOpenSettlementModal(target);
        return;
      }
    }

    setUpdatingOrderId(orderId);
    try {
      // Each transition is its own endpoint; the server enforces which are
      // legal from the current state.
      switch (newStatus) {
        case 'accepted':
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
        case 'rejected': {
          // Two different endpoints wear the same word. An order still sitting
          // in `placed` is DECLINED — the shop never took it on. One already
          // accepted is CANCELLED, which is the path that refunds a paid order.
          const target = orders.find((o) => o.id === orderId)
            || (selectedOrder?.id === orderId ? selectedOrder : null);
          if (target?.status === 'placed') {
            await api.orders.decline(orderId, 'Cancelled by shop');
          } else {
            await api.orders.cancel(orderId, 'Cancelled by shop');
          }
          break;
        }
        default:
          throw new Error(`Unsupported status transition: ${newStatus}`);
      }
      Toast.show({
        type: 'success',
        text1: t('orderUpdated'),
        text2: `Order status is now: ${newStatus}`,
      });
      await refreshOrder(orderId);
      if (checkNewOrders) checkNewOrders();
      
      // Sync modal view details
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => ({ ...prev, status: newStatus }));
      }
    } catch (e) {
      // The code and status are what identify this next time. "Something went
      // wrong" is the SERVER's default message for an unhandled exception
      // (envelope.ts), so seeing it means a 500 — not a rejected transition.
      console.error(
        `[Orders] ${newStatus} failed for ${orderId}: ${e?.code ?? 'UNKNOWN'} ${e?.status ?? ''}`.trim(),
        e,
      );
      Toast.show({
        type: 'error',
        text1: t('couldNotUpdateOrder'),
        // A 500 tells the shop nothing they can act on, so say the one useful
        // thing instead of repeating the server's placeholder.
        text2: e?.status >= 500 || e?.code === 'INTERNAL'
          ? 'The server had a problem. Please try again.'
          : getErrorText(e),
      });
      // INVALID_TRANSITION means the order moved on since this list was loaded
      // — another device, an admin, or simply a stale screen. The whole list
      // may be behind, so re-read all of it, but silently: the owner is looking
      // at an error toast, not at a loading spinner.
      fetchOrders({ silent: true });
    } finally {
      setUpdatingOrderId(null);
    }
  };


  const handleCall = (num) => {
    Linking.openURL(`tel:${num}`).catch(() => {
      Toast.show({
        type: 'error',
        text1: t('errorTitle'),
        text2: t('callingNotSupported'),
      });
    });
  };

  const handleWhatsApp = (num, name) => {
    // "Fresh Mart" was hardcoded, so every shop introduced itself as someone
    // else's business.
    const msg = `Hello ${name}, this is ${shop?.name || 'our store'}.`;
    openWhatsApp(num, msg, () =>
      Toast.show({ type: 'error', text1: t('badPhone', 'That number cannot be opened in WhatsApp') }),
    );
  };

  // Helper to parse order dates
  // `address` is the snapshot the order was placed against:
  // { label, address_line, area, pincode, lat, lng }. The card used to read
  // `delivery_address`, which the API has never sent, so the row was blank.
  const formatOrderAddress = useCallback((address) => {
    if (!address) return '';
    if (typeof address === 'string') return address;
    return [address.address_line, address.area, address.pincode].filter(Boolean).join(', ');
  }, []);

  // Explicit DD/MM/YYYY. toLocaleDateString() follows the device locale, which
  // rendered 20 August as "8/20/2026" on a US-locale phone.
  const formatOrderDate = useCallback((d) => {
    if (!d) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }, []);

  const parseOrderDate = useCallback((dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    const cleanStr = dateStr.replace(' at ', ' ');
    const d2 = new Date(cleanStr);
    if (!isNaN(d2.getTime())) return d2;
    return null;
  }, []);

  // Filter & Search Logic
  const processedOrders = useMemo(() => {
    // Filter out subscription orders — standing deliveries belong exclusively under the Subscriptions Screen
    let result = orders.filter(
      (o) => !o.isSubscription && !o.is_subscription && !o.standing_order_id && o.type !== 'subscription',
    );

    // Status Filter Chip logic
    if (activeFilter !== 'all') {
      if (activeFilter === 'upi' || activeFilter === 'cod') {
        result = result.filter(o => o.payment_method?.toLowerCase() === activeFilter);
      } else if (activeFilter === 'accepted' || activeFilter === 'preparing') {
        result = result.filter(o => o.status === 'accepted' || o.status === 'preparing');
      } else if (activeFilter === 'out_for_delivery') {
        result = result.filter(o => o.status === 'out_for_delivery' || o.status === 'ready');
      } else if (activeFilter === 'rejected' || activeFilter === 'cancelled') {
        // An order the shop turns down while it is still `placed` is DECLINED
        // server-side; `rejected` is not a status the API ever returns. The chip
        // matched only cancelled/rejected, so a declined order showed under
        // "All" and disappeared under "Cancelled" — getStatusStyle below has
        // known this all along and labels all four "Cancelled".
        result = result.filter(o =>
          ['cancelled', 'declined', 'rejected', 'voided'].includes(o.status));
      } else if (activeFilter === 'not_delivered') {
        result = result.filter(o => o.status === 'not_delivered');
      } else {
        result = result.filter(o => o.status === activeFilter);
      }
    }

    // In pending mode the server already returned only unfinished orders. With
    // a range chosen, filter to those IST days — comparing the order's own IST
    // date string avoids the drift a Date built from local parts introduces
    // around midnight.
    // The server already applied the range (see fetchOrders), so filtering it
    // again here would only re-narrow a set that is already correct.


    // Search bar logic (Customer Name, Order ID, Customer Mobile Number)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const qNoHash = q.replace(/^#/, '');
      const qDigits = q.replace(/\D/g, '');
      
      result = result.filter(o => {
        const orderNum = o.orderNumber?.toLowerCase() || '';
        const name = o.customer_name?.toLowerCase() || '';
        const idStr = o.id ? o.id.toString() : '';
        const phone = o.customer_phone?.toLowerCase() || '';
        const phoneDigits = phone.replace(/\D/g, '');

        const matchId = orderNum.includes(q) || orderNum.includes(qNoHash) || idStr.includes(qNoHash);
        const matchName = name.includes(q);
        const matchPhone = phone.includes(q) || (qDigits.length > 0 && phoneDigits.includes(qDigits));

        return matchId || matchName || matchPhone;
      });
    }

    // Unconfirmed / pending orders show at the very top, followed by newest orders.
    //
    // Recency is the ORDER NUMBER and the placed time — never `id`. That is an
    // opaque public id (ord_01M1XAT2V8RB…), and scraping the digits out of it
    // yielded a number whose size depends on how many letters the ULID happened
    // to contain, so the oldest order routinely sorted above the newest.
    const seq = (o) => parseInt(String(o.orderNumber ?? '').replace(/\D/g, ''), 10) || 0;
    const placedAt = (o) => new Date(o.createdAt || 0).getTime() || 0;

    result.sort((a, b) => {
      const isUnconfirmed = (s) => s === 'placed' || s === 'accepted' || s === 'preparing' || s === 'ready' || s === 'out_for_delivery';
      const pendingA = isUnconfirmed(a.status) ? 1 : 0;
      const pendingB = isUnconfirmed(b.status) ? 1 : 0;
      if (pendingA !== pendingB) return pendingB - pendingA;

      // LS-10143 beats LS-10142: the counter is monotonic, so it settles ties
      // between orders placed within the same second.
      const bySeq = seq(b) - seq(a);
      if (bySeq !== 0) return bySeq;

      return placedAt(b) - placedAt(a);
    });

    return result;
  }, [orders, activeFilter, range, searchQuery]);

  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'placed':
        return { bg: '#FEF3C7', text: '#D97706', label: t('statusNewPlaced') };
      case 'accepted':
      case 'preparing':
        return { bg: '#DBEAFE', text: '#2563EB', label: t('statusPreparing') };
      case 'out_for_delivery':
      case 'ready':
        return { bg: '#F5F3FF', text: '#7C3AED', label: t('outForDeliveryBtn') };
      case 'delivered':
      case 'completed':
        return { bg: '#D1FAE5', text: '#065F46', label: t('statusDelivered') };
      case 'cancelled':
      case 'rejected':
      // The API calls a shop-cancelled order `declined`; people read "Cancelled".
      // It was missing here, so those orders fell through to the default branch
      // and showed the raw status string.
      case 'declined':
      case 'voided':
        return { bg: '#FFE4E6', text: '#E11D48', label: t('statusCancelledLabel') };
      default:
        return { bg: '#F1F5F9', text: '#64748B', label: status || t('statusPendingLabel') };
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Filter and Search section */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>{t('ordersHeader', 'Order Manager')}</Text>
        <View style={styles.actionRow}>
          <View style={styles.searchBar}>
            <Search color={theme.colors.textLight} size={20} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('searchOrderPlaceholder')}
              placeholderTextColor={theme.colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              numberOfLines={1}
              multiline={false}
              allowFontScaling={false}
            />
          </View>

          {/* One control, and it says what it is showing. The old pair was a
              calendar that read "All Dates" and a sort toggle nobody needed. */}
          <TouchableOpacity
            style={[styles.dateFilterTrigger, !pendingMode && styles.dateFilterTriggerActive]}
            onPress={() => setPickerOpen(true)}
            activeOpacity={0.8}
          >
            <Calendar color={!pendingMode ? '#FFF' : theme.colors.textDark} size={18} />
            <Text
              style={!pendingMode ? styles.dateFilterTriggerTextActive : styles.dateFilterTriggerText}
              numberOfLines={1}
            >
              {rangeLabel}
            </Text>
            {/* An × once a range is on, so clearing it does not depend on
                finding the Clear button inside the calendar sheet. */}
            {pendingMode ? (
              <ChevronDown color={theme.colors.textDark} size={14} style={{ marginLeft: 2 }} />
            ) : (
              <TouchableOpacity
                onPress={() => setRange(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ marginLeft: 4 }}
              >
                <XCircle color="#FFF" size={16} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>



        {/* Horizontal Order Status Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={{ paddingRight: 16 }}>
          {ORDER_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.filterChip, activeFilter === f.value && styles.filterChipActive]}
              onPress={() => setActiveFilter(f.value)}
            >
              <Text style={[styles.filterChipText, activeFilter === f.value && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loaderText}>{t('fetchingActiveOrders')}</Text>
        </View>
      ) : (
        <FlatList
          data={processedOrders}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onPullToRefresh} colors={[theme.colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyStateWrap}>
            <View style={styles.emptyState}>
              <ShoppingBag size={48} color={theme.colors.border} />
              <Text style={styles.emptyTitle}>{t('noOrdersFound')}</Text>
              <Text style={styles.emptySub}>
                {pendingMode
                  ? 'Nothing waiting — every order is settled.'
                  : `No orders between ${pretty(range.from)} and ${pretty(range.to)}.`}
              </Text>
              {(!pendingMode || activeFilter !== 'all' || searchQuery !== '') && (
                <TouchableOpacity
                  style={styles.resetFilterBtn}
                  onPress={() => {
                    // Reset means back to the working list.
                    setRange(null);
                    setActiveFilter('all');
                    setSearchQuery('');
                  }}
                >
                  <Text style={styles.resetFilterBtnText}>{t('resetAllFilters')}</Text>
                </TouchableOpacity>
              )}
            </View>
            </View>
          }
          renderItem={({ item }) => {
            const statusConfig = getStatusStyle(item.status);
            return (
              <View style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderId}>#{item.orderNumber || item.id}</Text>
                    {/* adaptOrder emits `createdAt`; reading `created_at` gave
                        `new Date(undefined)` — "Invalid Date at Invalid Date". */}
                    {(() => {
                      const placedAt = parseOrderDate(item.createdAt);
                      return placedAt ? (
                        <Text style={styles.orderTime}>
                          {formatOrderDate(placedAt)} at{' '}
                          {placedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      ) : null;
                    })()}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusConfig.text }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>

                {/* Customer Details */}
                <View style={styles.customerRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.customer_name ? item.customer_name.charAt(0) : 'C'}
                    </Text>
                  </View>
                  <View style={styles.customerInfo}>
                    <Text style={styles.customerName}>{item.customer_name}</Text>
                    <Text style={styles.customerPhone}>{item.customer_phone?.startsWith('+') || item.customer_phone?.startsWith('91') ? item.customer_phone : `+91 ${item.customer_phone}`}</Text>
                  </View>
                  <View style={styles.comms}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleCall(item.customer_phone)}>
                      <Phone size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconBtn, { marginLeft: 8 }]} onPress={() => handleWhatsApp(item.customer_phone, item.customer_name)}>
                      <MessageCircle size={16} color="#22C55E" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Address Summary — hidden rather than shown empty when the
                    order carries no snapshot. */}
                {formatOrderAddress(item.address) ? (
                  <View style={styles.addressBox}>
                    <MapPin size={14} color={theme.colors.textLight} style={{ marginRight: 6, marginTop: 2 }} />
                    <Text style={styles.addressText} numberOfLines={2}>
                      {formatOrderAddress(item.address)}
                    </Text>
                  </View>
                ) : null}

                {/* Read-Only Customer Note Strip */}
                {/* adaptOrder emits `customerNote`; `customer_note` is undefined,
                    so the note the customer typed was delivered by the API and
                    then dropped by the app. */}
                {item.customerNote ? (
                  <View style={styles.readOnlyNoteStrip}>
                    <FileText size={14} color="#D97706" style={{ marginRight: 6, marginTop: 1 }} />
                    <Text style={styles.readOnlyNoteText} numberOfLines={2}>
                      <Text style={{ fontWeight: '800', color: '#B45309' }}>{t('noteLabel')} </Text>
                      {item.customerNote.replace(/^Customer Note:\s*/i, '')}
                    </Text>
                  </View>
                ) : null}

                {/* Items Summarized */}
                <CollapsibleOrderItems items={item.items} />

                <View style={styles.divider} />

                {/* Footer details & primary action trigger */}
                <View style={styles.footerRow}>
                  <View>
                    <Text style={styles.priceLabel}>
                      Order Total ({item.items?.length || item.itemsCount || 0}{' '}
                      {(item.items?.length || item.itemsCount || 0) === 1 ? 'item' : 'items'})
                    </Text>
                    <Text style={styles.priceValue}>₹{item.total.toFixed(2)}</Text>
                  </View>
                </View>

                {/* How the money actually landed. Every field here used to be
                    read under the wrong name — `paid_amount`, `khata_amount`
                    and `type`, where the adapter emits `cash`, `khata` and
                    `mode` — and the two modes it tested for, 'full_cod' and
                    'prepaid', are not in the API's enum at all. Nothing ever
                    matched, so the strip rendered its heading over an empty
                    row on every delivered order. */}
                {item.settlement ? (
                  <View style={styles.settlementStrip}>
                    <Text style={styles.settlementLabelTitle}>{settlementTitle(item.settlement.mode)}</Text>

                    {item.settlement.mode === 'partial' ? (
                      // A split is the only case where one number cannot tell
                      // the whole story, so show all three and what is owed.
                      <View style={styles.splitRows}>
                        <View style={styles.splitRow}>
                          <Text style={styles.splitLabel}>{t('orderTotalPlain')}</Text>
                          <Text style={styles.splitValue}>₹{item.total.toFixed(2)}</Text>
                        </View>
                        <View style={styles.splitRow}>
                          <Text style={styles.splitLabel}>💵 Paid now</Text>
                          <Text style={[styles.splitValue, styles.splitPaid]}>
                            ₹{item.settlement.cash.toFixed(2)}
                          </Text>
                        </View>
                        <View style={[styles.splitRow, styles.splitRowLast]}>
                          <Text style={styles.splitLabel}>📖 On khata</Text>
                          <Text style={[styles.splitValue, styles.splitKhata]}>
                            ₹{item.settlement.khata.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.settlementBadgesRow}>
                        {item.settlement.cash > 0 ? (
                          <View style={styles.paidBadge}>
                            <Text style={styles.paidBadgeText}>
                              💵 Paid ₹{item.settlement.cash.toFixed(2)}
                            </Text>
                          </View>
                        ) : null}
                        {item.settlement.khata > 0 ? (
                          <View style={styles.khataBadge}>
                            <Text style={styles.khataBadgeText}>
                              📖 On khata ₹{item.settlement.khata.toFixed(2)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    )}
                  </View>
                ) : item.status === 'delivered' ? (
                  <View style={styles.settlementStrip}>
                    <Text style={styles.settlementLabelTitle}>{t('statusDelivered')}</Text>
                  </View>
                ) : null}

                <View style={styles.actionsRow}>
                  <TouchableOpacity 
                    style={styles.detailsBtn} 
                    onPress={() => {
                      setSelectedOrder(item);
                    }}
                  >
                    <Text style={styles.detailsBtnText}>{t('detailsBtn')}</Text>
                  </TouchableOpacity>

                  {item.status === 'placed' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.declineBtn, updatingOrderId === item.id && styles.actionBtnBusy]}
                        disabled={updatingOrderId === item.id}
                        onPress={() => setCancelTarget(item)}
                      >
                        {updatingOrderId === item.id ? (
                          <ActivityIndicator size="small" color={theme.colors.error} />
                        ) : (
                          <Text style={styles.declineText}>{t('cancel')}</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.acceptBtn, updatingOrderId === item.id && styles.actionBtnBusy]}
                        disabled={updatingOrderId === item.id}
                        onPress={() => handleUpdateStatus(item.id, 'preparing')}
                      >
                        {updatingOrderId === item.id ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Text style={styles.acceptText}>{t('acceptBtn')}</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}

                  {/* The server's lifecycle is strictly linear:
                        placed → preparing → ready → out_for_delivery → delivered
                      Each status therefore gets exactly ONE next action. This
                      used to offer "Out for Delivery" straight from preparing
                      (skipping ready) and "Mark Delivered" from ready (skipping
                      out_for_delivery) — both rejected as INVALID_TRANSITION. */}
                  {/* Until the order is delivered the shop can still call it
                      off — stock ran out, the rider came back, nobody was in.
                      Before this the only way out after Accept was to let the
                      order sit, or mark a delivery that never happened. */}
                  {['accepted', 'preparing', 'ready', 'out_for_delivery'].includes(item.status) && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.declineBtn, updatingOrderId === item.id && styles.actionBtnBusy]}
                      disabled={updatingOrderId === item.id}
                      onPress={() => setCancelTarget(item)}
                    >
                      {updatingOrderId === item.id ? (
                        <ActivityIndicator size="small" color={theme.colors.error} />
                      ) : (
                        <Text style={styles.declineText}>{t('cancel')}</Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {(item.status === 'accepted' || item.status === 'preparing') && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.deliverBtn, { flex: 2 }, updatingOrderId === item.id && styles.actionBtnBusy]}
                      disabled={updatingOrderId === item.id}
                      onPress={() => handleUpdateStatus(item.id, 'ready')}
                    >
                      {updatingOrderId === item.id ? (
                        <ActivityIndicator size="small" color="#7C3AED" />
                      ) : (
                        <Text style={styles.deliverText}>{t('markReadyBtn')}</Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {item.status === 'ready' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.deliverBtn, { flex: 2 }, updatingOrderId === item.id && styles.actionBtnBusy]}
                      disabled={updatingOrderId === item.id}
                      onPress={() => handleUpdateStatus(item.id, 'out_for_delivery')}
                    >
                      {updatingOrderId === item.id ? (
                        <ActivityIndicator size="small" color="#7C3AED" />
                      ) : (
                        <Text style={styles.deliverText}>{t('outForDeliveryBtn')}</Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {item.status === 'out_for_delivery' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.completeBtn, { flex: 2 }]}
                      onPress={() => handleOpenSettlementModal(item)}
                    >
                      <Text style={styles.completeText}>{t('markDeliveredBtn')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* DETAIL MODAL */}
      <ConfirmSheet
        visible={!!cancelTarget}
        destructive
        busy={updatingOrderId === cancelTarget?.id}
        title={`Cancel ${cancelTarget?.orderNumber || 'this order'}?`}
        body={
          cancelTarget?.paymentStatus === 'paid' || cancelTarget?.paymentMethod === 'upi'
            ? 'The customer has already paid. Cancelling marks it Refund Pending and you settle the refund with them directly.'
            : cancelTarget?.status === 'placed'
              // Not yet accepted — this is a decline, and nothing was promised.
              ? 'The customer will be told you could not take this order. Nothing is charged.'
              : 'The customer will be told the shop cancelled it. Nothing is charged.'
        }
        cancelLabel={t('keepOrderBtn')}
        confirmLabel={t('cancelOrderBtn')}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => {
          const id = cancelTarget?.id;
          setCancelTarget(null);
          if (id) handleUpdateStatus(id, 'cancelled');
        }}
      />

      <OrderDetailSheet
        visible={!!selectedOrder}
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />

      <DateRangeSheet
        visible={pickerOpen}
        today={istToday()}
        initialFrom={range?.from}
        initialTo={range?.to}
        onClose={() => setPickerOpen(false)}
        onApply={({ from, to }) => {
          // Clearing the dates in the sheet means "back to the working list".
          setRange(from ? { from, to } : null);
          setPickerOpen(false);
        }}
      />

      {/* PAYMENT SETTLEMENT APPROVAL MODAL */}
      <PaymentSettlementModal
        visible={!!settlementTargetOrder}
        order={settlementTargetOrder}
        onClose={() => setSettlementTargetOrder(null)}
        onConfirm={handleConfirmSettlement}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.m,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textDark,
    height: '100%',
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  dateFilterTrigger: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginLeft: 8,
    gap: 4,
  },
  dateFilterTriggerActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dateFilterTriggerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginRight: 2,
    marginLeft: 4,
  },
  dateFilterTriggerTextActive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 2,
  },
  resetFilterBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  resetFilterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  filtersScroll: {
    marginHorizontal: -4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  filterChipTextActive: {
    color: theme.colors.primary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  listContent: {
    padding: theme.spacing.m,
    paddingBottom: 40,
    // Lets the empty state fill the screen so it can centre itself. With
    // content present this has no effect — flexGrow only expands a container
    // that is shorter than the viewport.
    flexGrow: 1,
  },
  emptyStateWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
    ...theme.shadows.soft,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 14,
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  orderTime: {
    fontSize: 11,
    color: theme.colors.textLight,
    fontWeight: '700',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  customerInfo: {
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
  comms: {
    flexDirection: 'row',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
  },
  addressText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    flex: 1,
  },
  itemSummary: {
    fontSize: 14,
    color: theme.colors.textDark,
    fontWeight: '700',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 11,
    color: theme.colors.textLight,
    fontWeight: '800',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  detailsBtn: {
    flex: 1,
    height: 40,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  detailsBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  actionBtn: {
    flex: 1.2,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnBusy: {
    opacity: 0.7,
  },
  declineBtn: {
    flex: 1.2,
    backgroundColor: '#FEE2E2',
    marginRight: 8,
  },
  declineText: {
    color: theme.colors.error,
    fontSize: 13,
    fontWeight: '800',
  },
  acceptBtn: {
    flex: 1.2,
    backgroundColor: theme.colors.primary,
  },
  acceptText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  readyBtn: {
    backgroundColor: '#D1FAE5',
  },
  readyText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '800',
  },
  deliverBtn: {
    backgroundColor: '#F5F3FF',
  },
  deliverText: {
    color: '#7C3AED',
    fontSize: 13,
    fontWeight: '800',
  },
  completeBtn: {
    backgroundColor: '#E0F2FE',
  },
  completeText: {
    color: '#0369A1',
    fontSize: 13,
    fontWeight: '800',
  },
  // Modal Style
  repayBtn: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  repayBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  compactOrderNoteStrip: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  compactOrderNoteStripApproved: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  compactOrderNoteTextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  compactOrderNoteText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    lineHeight: 16,
  },
  compactOrderNoteTextApproved: {
    color: '#15803D',
  },
  compactApproveNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#D97706',
  },
  compactApproveNoteText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  settlementStrip: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  settlementLabelTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textLight,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  splitRows: { marginTop: 8 },
  splitRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  splitRowLast: { borderBottomWidth: 0 },
  splitLabel: { fontSize: 12.5, fontWeight: '600', color: '#64748B' },
  splitValue: { fontSize: 13.5, fontWeight: '800', color: '#1E293B' },
  splitPaid: { color: '#15803D' },
  splitKhata: { color: '#B45309' },
  settlementBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  paidBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  paidBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  khataBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  khataBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7E22CE',
  },
  readOnlyNoteStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 8,
    marginBottom: 8,
  },
  readOnlyNoteText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
});
