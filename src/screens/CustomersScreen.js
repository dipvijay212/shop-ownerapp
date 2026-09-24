import React, { useState, useRef, useCallback, useContext, useEffect, useMemo } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Linking,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  Search,
  Phone,
  MessageCircle,
  Clock,
  X,
  Users,
  CheckCircle,
  ShieldCheck,
  Wallet,
  PlusCircle,
  MinusCircle,
  ChevronRight,
  ArrowLeft,
  Calendar as CalendarIcon,
} from 'lucide-react-native';
import { theme } from '../theme';
import KeyboardAwareForm from '../components/KeyboardAwareForm';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../constants/translations';
import { api } from '../api';
import { getErrorText } from '../api/errors';
import { openWhatsApp } from '../utils/phone';
import { AuthContext } from '../context/AuthContext';
import { adaptKhataCustomer, adaptKhataEntry, adaptKhataOrder, adaptOrder } from '../api/adapters';
import OwnerOrderCard from '../components/OwnerOrderCard';
import DateRangeSheet from '../components/DateRangeSheet';
import OrderDetailSheet from '../components/OrderDetailSheet';
import { newIdempotencyKey } from '../api/httpClient';
import { useScreenPadding } from '../hooks/useScreenPadding';

// Customers, balances and the audit trail all come from the khata API
// (GET /owner/khata/customers). Nothing about a ledger may be invented locally.

// What the pill says when the entry carries no payment mode of its own.
const ENTRY_LABEL = {
  udhari_charge: 'Udhari',
  advance_applied: 'From advance',
  advance_deposit: 'Deposit',
  repayment: 'Repayment',
  adjustment: 'Adjustment',
};

const istDayOf = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? null
    : new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
};
const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const prettyDay = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};

// `labelKey`, not `label`: this map is module-level, so a literal would freeze
// the badge to English. OwnerOrderCard resolves the key with its own `t`.
const ORDER_STATUS_STYLE = {
  placed: { bg: '#FEF3C7', text: '#D97706', labelKey: 'custStatusPlaced' },
  accepted: { bg: '#DBEAFE', text: '#2563EB', labelKey: 'statusPreparing' },
  preparing: { bg: '#DBEAFE', text: '#2563EB', labelKey: 'statusPreparing' },
  ready: { bg: '#E0E7FF', text: '#4338CA', labelKey: 'statusReady' },
  out_for_delivery: { bg: '#E0E7FF', text: '#4338CA', labelKey: 'custStatusOnTheWay' },
  delivered: { bg: '#DCFCE7', text: '#15803D', labelKey: 'statusDelivered' },
  not_delivered: { bg: '#FEE2E2', text: '#B91C1C', labelKey: 'statusNotDelivered' },
  cancelled: { bg: '#F1F5F9', text: '#64748B', labelKey: 'statusCancelledLabel' },
  rejected: { bg: '#FEE2E2', text: '#B91C1C', labelKey: 'statusRejected' },
};

export const CustomersScreen = () => {
  const { shop } = useContext(AuthContext);
  // Lists must clear the device's navigation bar, whatever height it is.
  const screenPad = useScreenPadding(24);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [customers, setCustomers] = useState([]);
  // The ledger rendered as an empty list while the first request was still in
  // flight, which reads as "you have no customers".
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [refreshingCustomers, setRefreshingCustomers] = useState(false);
  // Customers asking to open a khata with this shop. Khata is credit, so it is
  // the owner's decision — nobody can buy on Udhar until it is granted.
  const [khataRequests, setKhataRequests] = useState([]);
  const [decidingCustomerId, setDecidingCustomerId] = useState(null);
  // Approving a khata sets its udhari limit in the same step — the server
  // refuses an approval without one, so the form asks for it up front rather
  // than failing after the tap.
  const [limitDrafts, setLimitDrafts] = useState({});
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitDraft, setLimitDraft] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);
  const [limitError, setLimitError] = useState('');

  // Validation errors for the payment form render INSIDE the modal. A Toast
  // cannot: RN's Modal is a separate native window stacked above the app, so
  // <Toast /> (mounted in App.tsx under NavigationContainer) is painted behind
  // it and the message is invisible exactly when it matters.
  const [paymentError, setPaymentError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  // Two halves of the same question — what customers owe, and what they bought.
  // The Orders tab carries the whole archive: the Orders bottom-tab is now
  // today's working list, so this is where "everything, ever" lives.
  const [activeTab, setActiveTab] = useState('khata'); // 'khata' | 'orders'
  const [allOrders, setAllOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersRange, setOrdersRange] = useState({ from: null, to: null });
  const [ordersPickerOpen, setOrdersPickerOpen] = useState(false);
  const [orderDetail, setOrderDetail] = useState(null);
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [modalMode, setModalMode] = useState(null); // 'orders' | 'credit'
  const customerModalScrollRef = useRef(null);

  // Partial Payment States
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  // 'repayment' clears what is already owed and is capped at the outstanding
  // due. 'advance' takes money BEFORE it is owed — it does not touch the due,
  // it builds credit the next udhari charge spends automatically.
  const [paymentIntent, setPaymentIntent] = useState('repayment');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash'); // 'Cash' | 'UPI / GPay' | 'Bank Transfer'
  const [paymentNote, setPaymentNote] = useState('');

  const fetchCustomers = useCallback(async () => {
    try {
      const page = await api.khata.listCustomers({ limit: 50 });
      setCustomers((page?.items || []).map(adaptKhataCustomer));
    } catch (err) {
      console.error('[Customers] load failed', err);
      Toast.show({
        type: 'error',
        text1: t('couldNotLoadLedger'),
        text2: err.message || 'Please check your connection.',
      });
    } finally {
      setIsLoadingCustomers(false);
    }
  }, [t]);

  React.useEffect(() => {
    fetchCustomers().catch((e) => console.error('[Customers] load rejected', e));
  }, [fetchCustomers]);

  const fetchKhataRequests = useCallback(async () => {
    try {
      const page = await api.khata.listKhataRequests();
      setKhataRequests(page?.items || []);
    } catch (err) {
      console.error('[Customers] khata requests failed', err);
    }
  }, []);

  const handleKhataDecision = useCallback(
    async (customerId, approve, creditLimit) => {
      if (decidingCustomerId) return;
      setDecidingCustomerId(customerId);
      try {
        await api.khata.decideKhata(customerId, approve, creditLimit);
        Toast.show({
          type: 'success',
          text1: approve ? 'Khata approved' : 'Request declined',
          text2: approve
            ? 'This customer can now pay by Udhar.'
            : 'They will not be able to pay by Udhar.',
        });
        await Promise.all([fetchKhataRequests(), fetchCustomers()]);
      } catch (err) {
        console.error('[Customers] khata decision failed', err);
        Toast.show({
          type: 'error',
          text1: t('couldNotUpdateRequest'),
          text2: err.message || 'Please try again.',
        });
      } finally {
        setDecidingCustomerId(null);
      }
    },
    [decidingCustomerId, fetchKhataRequests, fetchCustomers, t],
  );

  // Declared after handleKhataDecision on purpose: a dependency array is
  // evaluated during render, so naming a `const` callback that is defined
  // further down throws "Cannot access before initialization" and takes the
  // whole screen with it.
  const approveWithLimit = useCallback(
    (customerId) => {
      const raw = String(limitDrafts[customerId] ?? '').trim();
      const value = Number(raw);
      if (!raw || !Number.isFinite(value) || value <= 0) {
        setLimitError('Enter an udhari limit greater than ₹0 before approving.');
        return;
      }
      setLimitError('');
      handleKhataDecision(customerId, true, value);
    },
    [limitDrafts, handleKhataDecision],
  );

  const onPullToRefresh = useCallback(async () => {
    setRefreshingCustomers(true);
    await Promise.all([fetchCustomers().catch(() => {}), fetchKhataRequests()]);
    setRefreshingCustomers(false);
  }, [fetchCustomers]);

  // The list row carries balances but not the audit trail, so opening a
  // customer pulls the detail and the immutable entry feed together.
  const openCustomer = useCallback(async (customer) => {
    setSelectedCustomer(customer);
    try {
      const [detail, activity] = await Promise.all([
        api.khata.getCustomer(customer.id),
        api.khata.getActivity(customer.id, { limit: 50 }),
      ]);
      setSelectedCustomer({
        ...adaptKhataCustomer(detail),
        // Ledger entries drive the Khata tab...
        history: (activity?.items || []).map(adaptKhataEntry),
        // ...and the orders list drives the History tab. Two different lists.
        orders: (activity?.orders || []).map(adaptKhataOrder),
      });
    } catch (e) {
      console.error('[Customers] detail load failed', e);
    }
  }, []);

  // A blank field clears the ceiling back to "no limit"; the API takes a
  // number, so clearing means sending 0 and reading that as unlimited is the
  // server's existing convention for a null limit.
  // The card reads these several times each; naming them once keeps the
  // markup about layout rather than arithmetic.
  const owed = selectedCustomer?.outstandingCredit ?? 0;
  const advance = selectedCustomer?.advanceBalance ?? 0;
  const limit = selectedCustomer?.creditLimit ?? null;
  // Headroom counts the advance, because that money is already the shop's
  // cover — but the BAR measures debt against the limit alone, so a customer
  // with a big advance does not look maxed out.
  const headroom = limit != null ? Math.max(0, limit - owed + advance) : null;
  const limitUsedPct = limit != null && limit > 0 ? (owed / limit) * 100 : 0;
  const limitTone = limitUsedPct >= 100 ? '#DC2626' : limitUsedPct >= 70 ? '#D97706' : '#16A34A';

  const saveCreditLimit = useCallback(async (customer) => {
    const raw = String(limitDraft).trim();
    const num = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(num) || num < 0) {
      Toast.show({ type: 'error', text1: t('invalidAmount', 'Enter a valid amount') });
      return;
    }
    setSavingLimit(true);
    try {
      await api.khata.setKhataLimit(customer.id, num);
      setEditingLimit(false);
      Toast.show({ type: 'success', text1: t('limitUpdated', 'Udhari limit updated') });
      await Promise.all([openCustomer(customer), fetchCustomers()]);
    } catch (e) {
      Toast.show({ type: 'error', text1: getErrorText(e) });
    } finally {
      setSavingLimit(false);
    }
  }, [limitDraft, fetchCustomers, openCustomer, t]);

  // A customer who has never set a profile name comes back with name: null —
  // likelier now that khata-approved customers appear before their first order.
  const filteredCustomers = customers.filter(c =>
    String(c.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(c.phone ?? '').includes(searchQuery)
  );

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
    // "Fresh Mart" was hardcoded, so every shop introduced itself as someone
    // else's business.
    const msg = `Hello ${name}, this is ${shop?.name || 'our store'}.`;
    openWhatsApp(num, msg, () =>
      Toast.show({ type: 'error', text1: t('badPhone', 'That number cannot be opened in WhatsApp') }),
    );
  };

  const handleRecordPayment = async () => {
    setPaymentError('');
    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPaymentError('Enter an amount greater than \u20b90.');
      return;
    }

    const outstanding = selectedCustomer?.outstandingCredit || 0;
    const isOverpaying = amountNum > outstanding;

    try {
      if (isOverpaying) {
        // Overpayment or zero-due: Record advance deposit. The backend automatically clears all
        // outstanding debt first and holds any remaining excess as advance balance.
        await api.khata.recordAdvance(
          selectedCustomer.id,
          {
            amount: amountNum,
            paymentMode: (paymentMode || 'cash').toLowerCase(),
            proofNote: paymentNote.trim() || undefined,
          },
          newIdempotencyKey(),
        );

        const excess = amountNum - outstanding;
        Toast.show({
          type: 'success',
          text1: t('paymentRecorded'),
          text2: outstanding > 0
            ? `\u20b9${outstanding.toFixed(2)} cleared debt, \u20b9${excess.toFixed(2)} held as advance.`
            : `\u20b9${amountNum.toFixed(2)} held as advance credit.`,
        });
      } else {
        // Exact or partial repayment of existing debt:
        await api.khata.recordRepayment(
          selectedCustomer.id,
          {
            amount: amountNum,
            paymentMode: (paymentMode || 'cash').toLowerCase(),
            proofNote: paymentNote.trim() || undefined,
          },
          newIdempotencyKey(),
        );

        const isFull = amountNum >= outstanding;
        Toast.show({
          type: 'success',
          text1: isFull ? 'Udhari Fully Cleared!' : 'Partial Payment Logged!',
          text2: `Recorded \u20b9${amountNum.toFixed(2)} via ${paymentMode}.`,
        });
      }

      setPaymentAmount('');
      setPaymentNote('');
      setShowPaymentForm(false);
      await Promise.all([fetchCustomers(), openCustomer(selectedCustomer)]);
    } catch (e) {
      console.error('[Customers] repayment failed', e);
      setPaymentError(e.message || 'Could not record payment. Please try again.');
    }
  };

  // Advance/credit balance (customer deposits money with the shop, then draws
  // it down) has NO equivalent in the khata API: the ledger only models credit
  // extended BY the shop (`outstanding`) and repayments against it. The deposit
  // and cut handlers were pure local-state fiction, so they are removed rather
  // than silently misfiling money in an append-only ledger.


  // `t` is rebuilt on every render (useTranslation returns a fresh arrow), so
  // listing it as a dependency made this callback — and therefore the effect
  // below — new on every render. Held in a ref instead: the identity stays
  // stable and the message still follows a language change.
  const tRef = useRef(t);
  tRef.current = t;

  // Latches on the ATTEMPT, not the result. Keyed off `allOrders.length === 0`
  // it re-fired forever whenever the shop had no orders yet or the request
  // failed — an unbroken fetch/render loop that froze the screen.
  const ordersRequested = useRef(false);

  const fetchAllOrders = useCallback(async () => {
    ordersRequested.current = true;
    setOrdersLoading(true);
    try {
      const page = await api.orders.listOrders({ limit: 50 });
      setAllOrders((page?.items || []).map(adaptOrder));
    } catch (e) {
      Toast.show({ type: 'error', text1: tRef.current('ordersLoadFailed', 'Could not load orders.') });
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // Loaded the first time the tab is opened, not on mount: most visits to this
  // screen are about the ledger. Pull to refresh for a second look.
  useEffect(() => {
    if (activeTab === 'orders' && !ordersRequested.current) fetchAllOrders();
  }, [activeTab, fetchAllOrders]);

  // Balances move whenever an order settles, which happens on another screen —
  // so re-read on focus rather than trusting whatever was fetched at mount.
  // Sits here, below every callback it names, because the dependency array runs
  // during render and a `const` declared later is still in its dead zone.
  useFocusEffect(
    useCallback(() => {
      fetchCustomers().catch((e) => console.error('[Customers] focus reload failed', e));
      fetchKhataRequests();
      if (ordersRequested.current) fetchAllOrders().catch((e) => console.error('[Orders] focus reload failed', e));
    }, [fetchCustomers, fetchKhataRequests, fetchAllOrders]),
  );

  const openOrderDetail = useCallback(async (order) => {
    // /owner/orders omits line items, so the summary alone would show the
    // invoice empty. Fetch the full order, and fall back to the summary
    // rather than refusing to open at all.
    setDetailLoadingId(order.id);
    try {
      setOrderDetail(adaptOrder(await api.orders.getOrder(order.id)));
    } catch (e) {
      setOrderDetail(order);
    } finally {
      setDetailLoadingId(null);
    }
  }, []);

  const visibleOrders = useMemo(() => {
    let rows = allOrders;
    if (ordersRange.from && ordersRange.to) {
      rows = rows.filter((o) => {
        const d = istDayOf(o.createdAt);
        return d ? d >= ordersRange.from && d <= ordersRange.to : true;
      });
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const digits = q.replace(/\D/g, '');
      rows = rows.filter((o) => {
        const phone = (o.customer_phone || '').replace(/\D/g, '');
        return (o.orderNumber || '').toLowerCase().includes(q.replace(/^#/, ''))
          || (o.customer_name || '').toLowerCase().includes(q)
          || (digits.length > 0 && phone.includes(digits));
      });
    }
    return rows;
  }, [allOrders, ordersRange, searchQuery]);

  return (
    <View style={styles.container}>
      {/* Top Search Bar */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTitleRow}>
          {navigation.canGoBack() ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
              <ArrowLeft color={theme.colors.textDark} size={22} />
            </TouchableOpacity>
          ) : null}
          <Text style={styles.headerTitle}>{t('khataHeader', 'Digital Khata Ledger')}</Text>
        </View>
        <View style={styles.searchBar}>
          <Search color={theme.colors.textLight} size={20} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={activeTab === 'orders'
              ? t('searchOrders', 'Search by order no, name or number')
              : t('searchCustomer', 'Search by name or mobile number')}
            placeholderTextColor={theme.colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.tabRow}>
          {[
            { key: 'khata', label: t('tabKhata', 'Khata') },
            { key: 'orders', label: t('tabAllOrders', 'All orders') },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnOn]}
              onPress={() => { setActiveTab(tab.key); setSearchQuery(''); }}
            >
              <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextOn]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {activeTab === 'orders' ? (
        <>
          <View style={styles.ordersFilterRow}>
            <TouchableOpacity
              style={[styles.rangeChip, ordersRange.from && styles.rangeChipOn]}
              onPress={() => setOrdersPickerOpen(true)}
            >
              <CalendarIcon
                size={14}
                color={ordersRange.from ? '#FFFFFF' : '#475569'}
                style={styles.rangeChipIcon}
              />
              <Text style={[styles.rangeChipText, ordersRange.from && styles.rangeChipTextOn]}>
                {ordersRange.from
                  ? ordersRange.from === ordersRange.to
                    ? prettyDay(ordersRange.from)
                    : `${prettyDay(ordersRange.from)} – ${prettyDay(ordersRange.to)}`
                  : t('allDates', 'All dates')}
              </Text>
            </TouchableOpacity>
            {ordersRange.from ? (
              <TouchableOpacity
                style={styles.rangeClear}
                onPress={() => setOrdersRange({ from: null, to: null })}
              >
                <Text style={styles.rangeClearText}>{t('historyClear', 'Clear')}</Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.flexSpacer} />
            <Text style={styles.ordersCount}>
              {visibleOrders.length} {visibleOrders.length === 1 ? t('order', 'order') : t('orders', 'orders')}
            </Text>
          </View>

          {ordersLoading ? (
            <View style={styles.ledgerLoading}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : (
            <FlatList
              data={visibleOrders}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.listContent, { paddingBottom: screenPad.bottom }]}
              refreshControl={
                <RefreshControl
                  refreshing={ordersLoading}
                  onRefresh={fetchAllOrders}
                  colors={[theme.colors.primary]}
                  tintColor={theme.colors.primary}
                />
              }
              renderItem={({ item }) => (
                <OwnerOrderCard
                  order={item}
                  onPress={() => openOrderDetail(item)}
                  loading={detailLoadingId === item.id}
                  statusConfig={ORDER_STATUS_STYLE[item.status] || ORDER_STATUS_STYLE.placed}
                  placedLabel={prettyDay(istDayOf(item.createdAt))}
                  addressLine={[item.address?.address_line, item.address?.area, item.address?.pincode]
                    .filter(Boolean)
                    .join(', ')}
                  onCall={(num) => num && Linking.openURL(`tel:${num}`)}
                  onWhatsApp={(num, name) => {
                    if (!num) return;
                    const msg = `Hello ${name || ''}, about your order ${item.orderNumber || ''}.`;
                    openWhatsApp(num, msg, () =>
                      Toast.show({ type: 'error', text1: t('badPhone', 'That number cannot be opened in WhatsApp') }),
                    );
                  }}
                />
              )}
              ListEmptyComponent={
                <View style={styles.ordersEmpty}>
                  <Text style={styles.ordersEmptyTitle}>{t('noOrdersFound', 'No orders found')}</Text>
                  <Text style={styles.ordersEmptySub}>
                    {ordersRange.from
                      ? t('noOrdersInRange', 'Nothing in these dates.')
                      : t('noOrdersYet', 'Orders will appear here as they come in.')}
                  </Text>
                </View>
              }
            />
          )}

          <DateRangeSheet
            visible={ordersPickerOpen}
            today={istToday()}
            initialFrom={ordersRange.from}
            initialTo={ordersRange.to}
            onClose={() => setOrdersPickerOpen(false)}
            onApply={({ from, to }) => {
              setOrdersRange({ from, to });
              setOrdersPickerOpen(false);
            }}
          />
        </>
      ) : (
      <>

      {khataRequests.length > 0 ? (
        <View style={styles.requestsBox}>
          <Text style={styles.requestsTitle}>
            Khata requests ({khataRequests.length})
          </Text>
          <Text style={styles.requestsHint}>
            {t('approveUdhariHint')}
          </Text>
          {limitError ? (
            <View style={styles.formErrorBox}>
              <Text style={styles.formErrorText}>{limitError}</Text>
            </View>
          ) : null}
          {khataRequests.map((req) => (
            <View key={req.customer_id} style={styles.requestRow}>
              <View style={styles.requestTopRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                    <Text style={styles.requestName}>{req.name || 'Customer'}</Text>
                    {req.request_source === 'subscription' ? (
                      <View style={styles.sourceTagSub}>
                        <Text style={styles.sourceTagSubText}>🔄 Subscription Request</Text>
                      </View>
                    ) : (
                      <View style={styles.sourceTagReg}>
                        <Text style={styles.sourceTagRegText}>🛍️ Regular Request</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.requestPhone}>+91 {req.phone}</Text>
                </View>
                {decidingCustomerId === req.customer_id ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleKhataDecision(req.customer_id, false)}
                  >
                    <Text style={styles.rejectBtnText}>{t('declineBtn')}</Text>
                  </TouchableOpacity>
                )}
              </View>

            {decidingCustomerId === req.customer_id ? null : (
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>{t('udhariLimitLabel')}</Text>
                <View style={styles.limitInputRow}>
                  <TextInput
                    style={styles.limitInput}
                    value={String(limitDrafts[req.customer_id] ?? '')}
                    onChangeText={(v) =>
                      setLimitDrafts((prev) => ({ ...prev, [req.customer_id]: v.replace(/[^0-9.]/g, '') }))
                    }
                    keyboardType="decimal-pad"
                    placeholder="2000"
                    placeholderTextColor={theme.colors.textLight}
                  />
                  <TouchableOpacity style={styles.approveBtn} onPress={() => approveWithLimit(req.customer_id)}>
                    <Text style={styles.approveBtnText}>{t('approveBtn')}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.limitHint}>
                  {t('udhariLimitHint')}
                </Text>
              </View>
            )}
            </View>
          ))}
        </View>
      ) : null}

      {isLoadingCustomers ? (
        <View style={styles.ledgerLoading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: screenPad.bottom },
          filteredCustomers.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshingCustomers}
            onRefresh={onPullToRefresh}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Users size={48} color={theme.colors.border} />
            <Text style={styles.emptyTitle}>{t('noCustomersFound')}</Text>
            <Text style={styles.emptySub}>
              {/* With no customers at all, blaming the search is wrong — there
                  is nothing to search. */}
              {searchQuery.trim() ? t('noCustomersSearchSub') : t('noCustomersYetSub')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.customerCard}>
            {/* Header info */}
            <View style={styles.cardHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.avatar}</Text>
              </View>
              <View style={styles.details}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.phone}>+91 {item.phone}</Text>
              </View>

            </View>

            {/* Metrics */}
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>{t('totalOrdersLabel')}</Text>
                <Text style={styles.metricValue}>{item.ordersCount}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>{t('lifeSpendingLabel')}</Text>
                <Text style={[styles.metricValue, { color: theme.colors.primary }]}>₹{item.lifetimeSpending.toFixed(0)}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>{t('outstandingLabel')}</Text>
                <Text style={[
                  styles.metricValue,
                  { color: item.outstandingCredit > 0 ? theme.colors.error : theme.colors.textDark }
                ]}>
                  ₹{item.outstandingCredit.toFixed(0)}
                </Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.actionsRow}>
              <View style={styles.communicationRow}>
                <TouchableOpacity style={styles.btnSmall} onPress={() => handleCall(item.phone)}>
                  <Phone size={16} color={theme.colors.textDark} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnSmall, { marginLeft: 8 }]} onPress={() => handleWhatsApp(item.phone, item.name)}>
                  <MessageCircle size={16} color="#22C55E" />
                </TouchableOpacity>
              </View>

              <View style={styles.navActionsRow}>
                <TouchableOpacity
                  style={[styles.btnAction, styles.btnSecondary]}
                  onPress={() => {
                    openCustomer(item).catch((e) => console.error('[Customers] open rejected', e));
                    setModalMode('orders');
                  }}
                >
                  <Text style={styles.btnSecondaryText}>{t('historyBtn')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnAction, styles.btnPrimary]}
                  onPress={() => {
                    openCustomer(item).catch((e) => console.error('[Customers] open rejected', e));
                    setModalMode('credit');
                  }}
                >
                  <Text style={styles.btnPrimaryText}>{t('khataShort')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />
      )}
      </>
      )}

      {/* CUSTOMER DETAIL MODAL */}
      <Modal visible={!!selectedCustomer} transparent animationType="slide" onRequestClose={() => setSelectedCustomer(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => {
                setSelectedCustomer(null);
                setShowPaymentForm(false);
              }}
            />

            <View style={[
              styles.modalContent,
              { paddingBottom: Math.max(insets.bottom + 16, Platform.OS === 'ios' ? 34 : 20) }
            ]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.avatar, { width: 36, height: 36, borderRadius: 18 }]}>
                    <Text style={[styles.avatarText, { fontSize: 14 }]}>{selectedCustomer?.avatar}</Text>
                  </View>
                  <Text style={styles.modalTitle}>{selectedCustomer?.name}</Text>
                </View>
                <TouchableOpacity onPress={() => {
                  setSelectedCustomer(null);
                  setShowPaymentForm(false);
                }}>
                  <X color={theme.colors.textDark} size={24} />
                </TouchableOpacity>
              </View>

              {/* Inside a Modal the manifest's adjustResize does not apply, so
                  the repayment amount field had nothing lifting it. */}
              <KeyboardAwareForm
                ref={customerModalScrollRef}
                style={styles.modalBody}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 20, 24) }}
              >
                {modalMode === 'orders' ? (
                  <>
                    <Text style={styles.modalSubtitle}>{t('orderActivityHistory')}</Text>
                    {/* Orders, not ledger entries. A customer who always pays in
                        full has orders but an empty khata, which is exactly why
                        this panel rendered blank. */}
                    {(selectedCustomer?.orders || []).length === 0 ? (
                      <Text style={styles.historyDateText}>{t('noOrdersFromCustomer')}</Text>
                    ) : (
                      (selectedCustomer?.orders || []).map((o) => (
                        <View key={o.id} style={styles.historyRow}>
                          <View style={styles.historyDetailColumn}>
                            <Text style={styles.historyDetailText}>
                              {o.orderNumber} · {String(o.status).replace(/_/g, ' ')}
                            </Text>
                            <Text style={styles.historyDateText}>{o.date}</Text>
                          </View>
                          <Text style={styles.historyAmountText}>₹{o.total.toFixed(2)}</Text>
                        </View>
                      ))
                    )}
                  </>
                ) : (
                  <>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.modalSubtitle}>{t('creditUdhariProfile')}</Text>
                      <View style={styles.shieldBadge}>
                        <ShieldCheck size={14} color="#15803D" style={{ marginRight: 4 }} />
                        <Text style={styles.shieldText}>{t('tamperProofLedger')}</Text>
                      </View>
                    </View>

                  {/* Balance summary. A NEGATIVE outstanding means the shop is
                      holding an advance for the customer, so it is stated as
                      credit rather than as a negative amount owed. */}
                  {/* Two DIFFERENT quantities, so two rows rather than one
                      signed number: what the customer owes, and what the shop
                      is holding for them. */}
                  {/* Three full-width blocks stacked with a sentence under
                      each read as a wall of numbers, and "₹3100 available"
                      sitting under "LIMIT ₹2000" looked like an error. The two
                      balances are a pair, so they sit side by side; the limit
                      is one bar showing how much of it is gone. */}
                  <View style={styles.balanceSummaryCard}>
                    <View style={styles.statPair}>
                      <View style={styles.statCell}>
                        <Text style={styles.balanceSummaryLabel}>{t('outstandingCaps')}</Text>
                        <Text style={[
                          styles.statValue,
                          { color: owed > 0 ? '#DC2626' : '#15803D' },
                        ]}>
                          ₹{owed.toFixed(2)}
                        </Text>
                        <Text style={styles.statHint}>
                          {owed > 0 ? 'Still owed to the shop' : 'Nothing owed'}
                        </Text>
                      </View>

                      <View style={styles.statDivider} />

                      <View style={styles.statCell}>
                        <Text style={styles.balanceSummaryLabel}>{t('advanceHeldCaps')}</Text>
                        <Text style={[
                          styles.statValue,
                          { color: advance > 0 ? '#16A34A' : theme.colors.textLight },
                        ]}>
                          ₹{advance.toFixed(2)}
                        </Text>
                        <Text style={styles.statHint}>
                          {advance > 0 ? 'Comes off the next udhari' : 'None held'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.limitBlock}>
                      <View style={styles.limitHeaderRow}>
                        <Text style={styles.balanceSummaryLabel}>{t('udhariLimitCaps')}</Text>
                        {!editingLimit ? (
                          <TouchableOpacity
                            onPress={() => {
                              setLimitDraft(limit != null ? String(limit) : '');
                              setEditingLimit(true);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.limitEditHint}>{t('editBtn')}</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      {editingLimit ? (
                        <View style={styles.limitEditRow}>
                          <Text style={styles.limitPrefix}>₹</Text>
                          <TextInput
                            style={styles.limitInput}
                            keyboardType="decimal-pad"
                            value={limitDraft}
                            onChangeText={setLimitDraft}
                            placeholder="0.00"
                            placeholderTextColor={theme.colors.textLight}
                            autoFocus
                          />
                          <TouchableOpacity
                            style={styles.limitSaveBtn}
                            disabled={savingLimit}
                            onPress={() => saveCreditLimit(selectedCustomer)}
                          >
                            {savingLimit ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={styles.limitSaveText}>{t('saveBtn')}</Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.limitCancelBtn}
                            onPress={() => setEditingLimit(false)}
                          >
                            <X size={16} color={theme.colors.textLight} />
                          </TouchableOpacity>
                        </View>
                      ) : limit != null ? (
                        <>
                          <Text style={styles.limitUsage}>
                            <Text style={styles.limitUsed}>₹{owed.toFixed(2)}</Text>
                            <Text style={styles.limitOf}> used of ₹{limit.toFixed(2)}</Text>
                          </Text>
                          <View style={styles.limitTrack}>
                            <View
                              style={[
                                styles.limitFill,
                                { width: `${Math.min(100, limitUsedPct)}%`, backgroundColor: limitTone },
                              ]}
                            />
                          </View>
                          <Text style={styles.statHint}>
                            {advance > 0
                              ? `₹${headroom.toFixed(2)} left, including the ₹${advance.toFixed(2)} advance.`
                              : `₹${headroom.toFixed(2)} left.`}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.limitNone}>{t('noLimitSet')}</Text>
                          <Text style={styles.statHint}>
                            {t('noLimitSetSub')}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  {!showPaymentForm ? (
                    <View style={styles.ledgerActionsRow}>
                      <TouchableOpacity
                        style={styles.openRecordPaymentFullBtn}
                        onPress={() => {
                          setPaymentAmount('');
                          setPaymentNote('');
                          setPaymentError('');
                          setShowPaymentForm(true);
                        }}
                      >
                        <Text style={styles.openRecordPaymentFullText}>{t('recordPayment')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.paymentFormCard}>
                      <Text style={styles.modalSubtitle}>{t('recordCustomerPayment')}</Text>
                      <Text style={styles.balanceSummaryHint}>
                        {selectedCustomer?.outstandingCredit > 0
                          ? `Clears part or all of \u20b9${selectedCustomer.outstandingCredit.toFixed(2)} due. Any extra amount will be added as advance held.`
                          : 'Enter amount to hold as advance credit for this customer.'}
                      </Text>

                      <Text style={styles.inputLabel}>{t('amountLabel')}</Text>
                      <TextInput
                        style={styles.paymentInput}
                        value={paymentAmount}
                        onChangeText={setPaymentAmount}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={theme.colors.textLight}
                      />

                      <Text style={styles.inputLabel}>{t('paymentModeLabel')}</Text>
                      <View style={styles.modeRow}>
                        {['Cash', 'UPI', 'Bank'].map((mode) => (
                          <TouchableOpacity
                            key={mode}
                            style={[styles.modeBtn, paymentMode === mode && styles.modeBtnActive]}
                            onPress={() => setPaymentMode(mode)}
                          >
                            <Text style={[styles.modeText, paymentMode === mode && styles.modeTextActive]}>
                              {mode}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={styles.inputLabel}>{t('noteReceiptOptional')}</Text>
                      <TextInput
                        style={styles.paymentInput}
                        value={paymentNote}
                        onChangeText={setPaymentNote}
                        placeholder={t('txnIdPlaceholder')}
                        placeholderTextColor={theme.colors.textLight}
                      />

                      {paymentError ? (
                        <View style={styles.formErrorBox}>
                          <Text style={styles.formErrorText}>{paymentError}</Text>
                        </View>
                      ) : null}

                      <View style={styles.formActionsRow}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPaymentForm(false)}>
                          <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.confirmPayBtn} onPress={handleRecordPayment}>
                          <Text style={styles.repayBtnText}>{t('recordPayment')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Audit Proof Ledger History */}
                  <View style={styles.historyHeaderRow}>
                    <Text style={styles.historyHeader}>{t('tamperProofAuditHistory')}</Text>
                    <Text style={styles.historySubText}>
                      {t('auditHistorySub')}
                    </Text>
                  </View>

                  {(selectedCustomer?.history || []).length === 0 ? (
                    <Text style={styles.historyDateText}>
                      {t('noKhataEntries')}
                    </Text>
                  ) : null}

                  {(selectedCustomer?.history || []).filter(h =>
                    h.type === 'credit' || h.type === 'payment'
                  ).map((h) => {
                    const isPositive = h.type === 'deposit' || h.type === 'payment';
                    const isDeposit = h.type === 'deposit';
                    const isCut = h.type === 'balance_cut';

                    let badgeBg = '#FEE2E2';
                    let badgeColor = '#991B1B';
                    let amountColor = '#DC2626';

                    if (isDeposit) {
                      badgeBg = '#DCFCE7';
                      badgeColor = '#15803D';
                      amountColor = '#16A34A';
                    } else if (isCut) {
                      badgeBg = '#F3E8FF';
                      badgeColor = '#6B21A8';
                      amountColor = '#7E22CE';
                    } else if (h.type === 'payment') {
                      badgeBg = '#DCFCE7';
                      badgeColor = '#15803D';
                      amountColor = '#16A34A';
                    }

                    return (
                      <TouchableOpacity
                        key={h.id}
                        style={[
                          styles.auditCard,
                          isPositive ? styles.auditCardPay : styles.auditCardDue,
                          detailLoadingId === h.orderId && styles.auditCardBusy,
                        ]}
                        // A repayment or a plain deposit has no order behind it;
                        // only rows that came from one are worth opening.
                        activeOpacity={h.orderId ? 0.7 : 1}
                        disabled={!h.orderId || detailLoadingId === h.orderId}
                        onPress={h.orderId ? () => openOrderDetail({ id: h.orderId }) : undefined}
                      >
                        <View style={styles.auditTopRow}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={styles.auditDetailTitle}>{h.detail}</Text>
                            </View>
                            <View style={styles.auditDateRow}>
                              <Clock size={12} color={theme.colors.textLight} style={{ marginRight: 4 }} />
                              <Text style={styles.auditDateText}>{h.date}</Text>
                            </View>
                            {/* A part-paid order puts only its khata half in the
                                ledger, so ₹40 appears against an ₹80 order with
                                nothing to explain the gap. Spell it out. */}
                            {h.settlement?.mode === 'partial' && h.entryType === 'udhari_charge' ? (
                              <View style={styles.splitNote}>
                                <Text style={styles.splitNoteText}>
                                  Order ₹{(h.orderTotal ?? 0).toFixed(2)}
                                  {'  ·  '}
                                  <Text style={styles.splitNotePaid}>
                                    ₹{h.settlement.cash.toFixed(2)} paid
                                  </Text>
                                  {'  ·  '}
                                  <Text style={styles.splitNoteKhata}>
                                    ₹{h.settlement.khata.toFixed(2)} on khata
                                  </Text>
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.auditAmount, { color: amountColor }]}>
                              {h.amount}
                            </Text>
                            <View style={[styles.modeBadge, { backgroundColor: badgeBg }]}>
                              <Text style={[styles.modeBadgeText, { color: badgeColor }]}>
                                {h.mode || ENTRY_LABEL[h.entryType] || 'Udhari'}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Verification Audit Footer inside card */}
                        <View style={styles.auditFooterBox}>
                          {h.note ? (
                            <View style={styles.auditNoteColumn}>
                              <Text style={styles.auditNoteLabel}>{t('noteLabel')}</Text>
                              <Text style={styles.auditNoteValue}>{h.note}</Text>
                            </View>
                          ) : null}
                          <View style={styles.auditBalanceColumn}>
                            <Text style={styles.auditBalanceLabel}>
                              {isDeposit || isCut ? 'BALANCE AFTER TXN' : 'DUE AFTER TXN'}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                              <CheckCircle size={14} color="#16A34A" style={{ marginRight: 4 }} />
                              <Text style={styles.auditBalanceValue}>
                                ₹{h.balanceAfter !== undefined ? h.balanceAfter.toFixed(2) : '0.00'}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Says the row is worth a tap, and which order it opens. */}
                        {h.orderId ? (
                          <View style={styles.auditOpenRow}>
                            {detailLoadingId === h.orderId ? (
                              <ActivityIndicator size="small" color={theme.colors.primary} />
                            ) : (
                              <>
                                <Text style={styles.auditOpenText}>
                                  {t('viewOrder', 'View order')} {h.orderNo ? `#${h.orderNo}` : ''}
                                </Text>
                                <ChevronRight size={14} color={theme.colors.primary} />
                              </>
                            )}
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </KeyboardAwareForm>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Last in the tree so it lands above the customer sheet: a ledger row
          opens the order without losing the customer behind it. */}
      <OrderDetailSheet
        visible={!!orderDetail}
        order={orderDetail}
        onClose={() => setOrderDetail(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row', backgroundColor: '#F1F5F9',
    borderRadius: 12, padding: 4, marginTop: 12,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  tabBtnOn: { backgroundColor: '#FFFFFF' },
  tabBtnText: { fontSize: 13.5, fontWeight: '700', color: '#64748B' },
  tabBtnTextOn: { color: theme.colors.primary, fontWeight: '800' },
  ordersFilterRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  rangeChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F1F5F9',
  },
  rangeChipOn: { backgroundColor: theme.colors.primary },
  rangeChipIcon: { marginRight: 5 },
  rangeChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  rangeChipTextOn: { color: '#FFFFFF' },
  rangeClear: { paddingHorizontal: 10, paddingVertical: 7 },
  rangeClearText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  flexSpacer: { flex: 1 },
  ordersCount: { fontSize: 11.5, fontWeight: '700', color: '#94A3B8' },
  ordersEmpty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  ordersEmptyTitle: { fontSize: 16, fontWeight: '800', color: '#334155' },
  ordersEmptySub: {
    fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 6, lineHeight: 19,
  },
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
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerBack: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    marginRight: 4, marginLeft: -8, marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 12,
  },
  searchBar: {
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
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textDark,
    height: '100%',
  },
  requestsBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 14,
    marginHorizontal: theme.spacing.m,
    marginTop: theme.spacing.m,
    padding: 14,
  },
  requestsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  requestsHint: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
    marginBottom: 10,
  },
  limitRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  limitLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 6,
  },
  limitInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  limitInput: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginRight: 8,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textDark,
    backgroundColor: '#FFF',
  },
  limitHint: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 6,
  },
  requestRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  requestTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  requestPhone: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginTop: 1,
  },
  rejectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    marginRight: 8,
  },
  rejectBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  approveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
  },
  approveBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFF',
  },
  ledgerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  listContent: {
    padding: theme.spacing.m,
    paddingBottom: 30,
  },
  customerCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  details: {
    marginLeft: 12,
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  phone: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textLight,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusActiveText: {
    color: '#15803D',
  },
  statusInactive: {
    backgroundColor: '#F1F5F9',
  },
  statusInactiveText: {
    color: '#64748B',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  communicationRow: {
    flexDirection: 'row',
  },
  btnSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navActionsRow: {
    flexDirection: 'row',
  },
  btnAction: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  btnSecondary: {
    backgroundColor: '#F1F5F9',
  },
  btnSecondaryText: {
    color: theme.colors.textDark,
    fontSize: 13,
    fontWeight: '800',
  },
  btnPrimary: {
    backgroundColor: theme.colors.primary,
  },
  btnPrimaryText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
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
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.spacing.m,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginLeft: 10,
  },
  modalBody: {
    marginTop: 14,
  },
  modalSubtitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 12,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: 12,
  },
  historyDetailColumn: {
    flex: 1,
    marginRight: 10,
  },
  historyDetailText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  historyDateText: {
    fontSize: 11,
    color: theme.colors.textLight,
    fontWeight: '700',
    marginTop: 2,
  },
  historyAmountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  creditBox: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: '#FED7D7',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  creditLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  creditAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.error,
    marginTop: 4,
  },
  historyHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 8,
  },
  repayBtn: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  repayBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B9F8CF',
  },
  shieldText: {
    fontSize: 10,
    fontWeight: '850',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  liveStatusBadge: {
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEB2B2',
  },
  liveStatusText: {
    fontSize: 11,
    fontWeight: '850',
    color: theme.colors.error,
  },
  statPair: { flexDirection: 'row', alignItems: 'stretch' },
  statCell: { flex: 1 },
  statDivider: { width: 1, backgroundColor: theme.colors.border, marginHorizontal: 14 },
  statValue: { fontSize: 21, fontWeight: '800', marginTop: 3 },
  statHint: { fontSize: 11, fontWeight: '600', color: theme.colors.textLight, marginTop: 3, lineHeight: 15 },
  limitBlock: {
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  limitHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  limitUsage: { marginTop: 5 },
  limitUsed: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  limitOf: { fontSize: 13, fontWeight: '600', color: theme.colors.textLight },
  limitTrack: {
    height: 6, borderRadius: 3, backgroundColor: '#E2E8F0',
    marginTop: 8, marginBottom: 6, overflow: 'hidden',
  },
  limitFill: { height: 6, borderRadius: 3 },
  limitNone: { fontSize: 17, fontWeight: '800', color: theme.colors.textLight, marginTop: 5 },
  limitEditHint: {
    fontSize: 11.5, fontWeight: '800', color: theme.colors.primary,
    marginLeft: 10, textDecorationLine: 'underline',
  },
  limitEditRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  limitPrefix: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginRight: 4 },
  limitSaveBtn: {
    backgroundColor: theme.colors.primary, borderRadius: 9,
    paddingHorizontal: 14, paddingVertical: 9, minWidth: 62, alignItems: 'center',
  },
  limitSaveText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  limitCancelBtn: { padding: 8, marginLeft: 2 },
  openAdvanceBtn: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openAdvanceText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  balanceSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 14,
  },
  balanceSummaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textLight,
    letterSpacing: 0.4,
  },
  balanceSummaryHint: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginTop: 4,
    marginBottom: 4,
  },
  ledgerActionsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  openRepayBtn: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  openRepayText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  paymentFormCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '850',
    color: theme.colors.textDark,
  },
  formInstruction: {
    fontSize: 12,
    color: theme.colors.textLight,
    fontWeight: '600',
    marginBottom: 14,
    lineHeight: 18,
  },
  quickAmtRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  quickAmtPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  quickAmtText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 6,
    marginTop: 4,
  },
  paymentInput: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textDark,
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: 'row',
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  modeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: '#FFF',
    marginRight: 8,
    marginBottom: 6,
  },
  modeBtnActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  modeText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textLight,
  },
  modeTextActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  formErrorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  formErrorText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#991B1B',
  },
  formActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#FFF',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  confirmPayBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginLeft: 8,
  },
  confirmPayText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  historyHeaderRow: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 8,
  },
  historySubText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 2,
  },
  auditCardBusy: { opacity: 0.6 },
  auditOpenRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    marginTop: 8, minHeight: 20,
  },
  auditOpenText: {
    fontSize: 11.5, fontWeight: '800', color: theme.colors.primary, marginRight: 2,
  },
  auditCard: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 6,
    ...theme.shadows.small,
  },
  auditCardPay: {
    borderColor: '#DCFCE7',
    borderLeftColor: '#22C55E',
  },
  auditCardDue: {
    borderColor: '#FEE2E2',
    borderLeftColor: '#EF4444',
  },
  auditTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  auditDetailTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginRight: 8,
  },
  splitNote: {
    marginTop: 6, backgroundColor: '#FFFBEB', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5, alignSelf: 'flex-start',
  },
  splitNoteText: { fontSize: 11.5, fontWeight: '700', color: '#92400E' },
  splitNotePaid: { color: '#15803D' },
  splitNoteKhata: { color: '#B45309' },
  auditDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  auditDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textLight,
  },
  auditAmount: {
    fontSize: 18,
    fontWeight: '900',
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '850',
  },
  auditFooterBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  auditNoteColumn: {
    flex: 1,
    marginRight: 12,
  },
  auditNoteLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  auditNoteValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginTop: 2,
  },
  auditBalanceColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  auditBalanceLabel: {
    fontSize: 10,
    fontWeight: '850',
    color: '#64748B',
  },
  auditBalanceValue: {
    fontSize: 14,
    fontWeight: '850',
    color: '#0F172A',
  },

  // Advance Balance Styles
  advanceBalanceBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.small,
  },
  advanceTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  walletIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  advanceBoxLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#166534',
  },
  advanceBoxSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
    marginTop: 2,
  },
  advanceBalanceHeroRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    marginBottom: 12,
  },
  balanceBadgeLabel: {
    fontSize: 11,
    fontWeight: '850',
    color: '#166534',
    letterSpacing: 0.6,
  },
  advanceBoxAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#15803D',
  },
  advanceActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  depositBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  depositBtnText: {
    color: '#15803D',
    fontSize: 12.5,
    fontWeight: '800',
  },
  cutBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  cutBtnText: {
    color: '#991B1B',
    fontSize: 12.5,
    fontWeight: '800',
  },
  sourceTagSub: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceTagSubText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  sourceTagReg: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceTagRegText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  openRecordPaymentFullBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#16A34A',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  openRecordPaymentFullText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
